import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { OrderService } from './orders.service';
import { Dish } from 'src/restaurants/entities/dish.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus } from './entities/order.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from 'src/users/entities/user.entity';
import { PubSub } from 'graphql-subscriptions';
import {
  NEW_COOKED_ORDER,
  NEW_ORDER_UPDATE,
  NEW_PENDING_ORDER,
  PUB_SUB,
} from 'src/common/common.constants';

const mockRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  find: jest.fn(),
});

const createOrderUser = {
  id: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  email: 'test@test.com',
  password: 'test',
  role: UserRole.Client,
  verified: false,
  restaurants: [],
  orders: [],
  payments: [],
  rides: [],
  hashPassword: null,
  checkPassword: null,
};

const order = {
  customerId: 2,
  driverId: 2,
  restaurant: {
    id: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: 2,
    name: 'testName',
    coverImage: null,
    address: 'testAddress',
    category: {
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: 'testCategoryName',
      coverImage: null,
      slug: 'test',
      restaurants: [],
    },
    owner: createOrderUser,
    orders: [],
    menu: [],
    isPromoted: false,
  },
  items: [],
  status: OrderStatus.Pending,
  id: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const pubSubService = () => ({
  publish: jest.fn(),
});

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: MockRepository<Order>;
  let orderItemRepository: MockRepository<OrderItem>;
  let restaurantRepository: MockRepository<Restaurant>;
  let dishRepository: MockRepository<Dish>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Restaurant),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Dish),
          useValue: mockRepository(),
        },
        {
          provide: PUB_SUB,
          useValue: pubSubService(),
        },
      ],
    }).compile();
    service = module.get<OrderService>(OrderService);
    orderRepository = module.get(getRepositoryToken(Order));
    orderItemRepository = module.get(getRepositoryToken(OrderItem));
    restaurantRepository = module.get(getRepositoryToken(Restaurant));
    dishRepository = module.get(getRepositoryToken(Dish));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Create Order', () => {
    const optionsArray = [
      { name: 'testOptions', extra: 7 },
      { name: 'testOptions2', extra: 8 },
    ];

    const createOrderArgs = {
      restaurantId: 1,
      items: [
        {
          dishId: 1,
          options: optionsArray,
        },
      ],
    };

    const dish = {
      id: 1,
      name: 'testDish',
      price: 5,
      options: optionsArray,
    };

    it('음식점이 존재하지 않을 때', async () => {
      restaurantRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createOrder(
        createOrderUser,
        createOrderArgs,
      );

      expect(result).toMatchObject({
        ok: false,
        error: '음식점이 존재하지 않습니다.',
      });
    });

    it('음식이 존재하지 않습니다.', async () => {
      restaurantRepository.findOne.mockResolvedValue({ id: 1 });
      dishRepository.findOne.mockResolvedValue(null);

      const result = await service.createOrder(
        createOrderUser,
        createOrderArgs,
      );

      expect(result).toMatchObject({
        ok: false,
        error: '음식이 존재하지 않습니다.',
      });
    });

    it('주문 성공', async () => {
      const order = {
        id: 1,
        customer: createOrderUser,
        restaurant: { id: 1 },
        total:
          dish.price +
          optionsArray
            .map((item) => item.extra)
            .reduce((prev, curr) => prev + curr),
      };

      restaurantRepository.findOne.mockResolvedValue({ id: 1 });
      dishRepository.findOne.mockResolvedValue(dish);
      orderItemRepository.create.mockReturnValue(dish);
      orderItemRepository.save.mockResolvedValue(dish);
      orderRepository.create.mockReturnValue(order);
      orderRepository.save.mockResolvedValue(order);

      const result = await service.createOrder(
        createOrderUser,
        createOrderArgs,
      );

      expect(orderItemRepository.create).toHaveBeenCalledTimes(1);
      expect(orderItemRepository.create).toHaveBeenCalledWith(
        expect.any(Object),
      );

      expect(orderItemRepository.save).toHaveBeenCalledTimes(1);
      expect(orderItemRepository.save).toHaveBeenCalledWith(expect.any(Object));

      expect(orderRepository.create).toHaveBeenCalledTimes(1);
      expect(orderRepository.create).toHaveBeenCalledWith(expect.any(Object));

      expect(orderRepository.save).toHaveBeenCalledTimes(1);
      expect(orderRepository.save).toHaveBeenCalledWith(expect.any(Object));

      expect(result).toEqual({
        ok: true,
        orderId: order.id,
      });
    });

    it('주문 실패', async () => {
      restaurantRepository.findOne.mockRejectedValue(new Error(':)'));
      const result = await service.createOrder(
        createOrderUser,
        createOrderArgs,
      );

      expect(result).toEqual({
        ok: false,
        error: '주문에 실패 했습니다',
      });
    });
  });

  describe('Get Orders', () => {
    it('손님일때 주문목록 가져오기', async () => {
      const getOrdersUser = {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Client,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      const getOrdersArgs = [
        {
          id: 1,
        },
        {
          id: 2,
        },
      ];

      orderRepository.find.mockResolvedValue(getOrdersArgs);

      const result = await service.getOrders(getOrdersUser, {
        status: OrderStatus.Pending,
      });

      expect(result).toEqual({
        ok: true,
        orders: getOrdersArgs,
      });
    });

    it('배달기사 일때 주문목록 가져오기', async () => {
      const getOrdersUser = {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Delivery,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      const getOrdersArgs = [
        {
          id: 1,
        },
        {
          id: 2,
        },
      ];

      orderRepository.find.mockResolvedValue(getOrdersArgs);

      const result = await service.getOrders(getOrdersUser, {
        status: OrderStatus.Pending,
      });

      expect(result).toEqual({
        ok: true,
        orders: getOrdersArgs,
      });
    });

    it('가게주인 일때 주문목록 가져오기', async () => {
      const getOrdersUser = {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Owner,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      const getOrdersArgs = [
        {
          id: 1,
          orders: [
            { id: 1, status: OrderStatus.Pending },
            { id: 2, status: OrderStatus.Pending },
          ],
        },
        {
          id: 2,
          orders: [
            { id: 3, status: OrderStatus.Pending },
            { id: 4, status: OrderStatus.Pending },
          ],
        },
      ];

      restaurantRepository.find.mockResolvedValue(getOrdersArgs);

      const result = await service.getOrders(getOrdersUser, {
        status: OrderStatus.Pending,
      });

      expect(result).toEqual({
        ok: true,
        orders: getOrdersArgs.map((restaurant) => restaurant.orders).flat(1),
      });
    });

    it('주문목록 가져오기 실패', async () => {
      const getOrdersUser = {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Client,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      orderRepository.find.mockRejectedValue(new Error(':)'));

      const result = await service.getOrders(getOrdersUser, {
        status: OrderStatus.Pending,
      });

      expect(result).toEqual({
        ok: false,
        error: '주문목록을 가져 올 수 없습니다.',
      });
    });
  });

  describe('Can Allowed Order', () => {
    it('유저가 고객일 때', () => {
      const user = {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Client,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      const result = service.canAllowedOrder(user, order);
      expect(result).toBeFalsy();
    });

    it('유저가 배달기사일 때', () => {
      const user = {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Delivery,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      const result = service.canAllowedOrder(user, order);
      expect(result).toBeFalsy();
    });

    it('유저가 고객일 때', () => {
      const user = {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Owner,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      const result = service.canAllowedOrder(user, order);
      expect(result).toBeFalsy();
    });
  });

  describe('Get Order', () => {
    const user = {
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      email: 'test@test.com',
      password: 'test',
      role: UserRole.Client,
      verified: false,
      restaurants: [],
      orders: [],
      payments: [],
      rides: [],
      hashPassword: null,
      checkPassword: null,
    };

    it('주문을 찾을 수 없음', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      const result = await service.getOrder(user, { id: 1 });

      expect(result).toEqual({
        ok: false,
        error: '주문을 찾을수 없습니다 다시한번 확인해주세요',
      });
    });

    it('권한 확인', async () => {
      orderRepository.findOne.mockResolvedValue(order);

      const result = await service.getOrder(user, { id: 1 });

      expect(result).toEqual({
        ok: false,
        error: '권한을 확인해주세요',
      });
    });

    it('주문 검색 성공', async () => {
      const orderSearchSuccessUser = {
        id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Client,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };
      orderRepository.findOne.mockResolvedValue(order);

      const result = await service.getOrder(orderSearchSuccessUser, { id: 1 });

      expect(result).toEqual({
        ok: true,
        order,
      });
    });

    it('주문 검색 실패', async () => {
      orderRepository.findOne.mockRejectedValue(new Error(':('));

      const result = await service.getOrder(user, { id: 1 });

      expect(result).toEqual({
        ok: false,
        error: '주문 검색 실패',
      });
    });
  });

  describe('Edit Order', () => {
    const user = {
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      email: 'test@test.com',
      password: 'test',
      role: UserRole.Client,
      verified: false,
      restaurants: [],
      orders: [],
      payments: [],
      rides: [],
      hashPassword: null,
      checkPassword: null,
    };
    it('주문을 찾을 수 없음', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      const result = await service.editOrder(user, {
        id: 1,
        status: OrderStatus.Cooking,
      });

      expect(result).toEqual({
        ok: false,
        error: '주문을 찾을수 없습니다 다시한번 확인해주세요',
      });
    });

    it('권한 확인', async () => {
      orderRepository.findOne.mockResolvedValue(order);

      const result = await service.editOrder(user, {
        id: 1,
        status: OrderStatus.Cooking,
      });

      expect(result).toEqual({
        ok: false,
        error: '권한을 확인해주세요',
      });
    });

    it('고객 수정 권한 확인', async () => {
      const orderSearchSuccessUser = {
        id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Client,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      orderRepository.findOne.mockResolvedValue(order);

      const result = await service.editOrder(orderSearchSuccessUser, {
        id: 1,
        status: OrderStatus.Cooking,
      });

      expect(result).toEqual({
        ok: false,
        error: '수정 할 수 없습니다 권한을 확인해주세요',
      });
    });

    it('가게주인 수정 권한 확인', async () => {
      const orderSearchSuccessUser = {
        id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Owner,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      orderRepository.findOne.mockResolvedValue(order);

      const result = await service.editOrder(orderSearchSuccessUser, {
        id: 1,
        status: OrderStatus.Pending,
      });

      expect(result).toEqual({
        ok: false,
        error: '수정 할 수 없습니다 권한을 확인해주세요',
      });
    });

    it('배달기사 수정 권한 확인', async () => {
      const orderSearchSuccessUser = {
        id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Delivery,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      orderRepository.findOne.mockResolvedValue(order);

      const result = await service.editOrder(orderSearchSuccessUser, {
        id: 1,
        status: OrderStatus.Cooked,
      });

      expect(result).toEqual({
        ok: false,
        error: '수정 할 수 없습니다 권한을 확인해주세요',
      });
    });

    it('주문 상태 변경 성공', async () => {
      const orderSearchSuccessUser = {
        id: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        password: 'test',
        role: UserRole.Owner,
        verified: false,
        restaurants: [],
        orders: [],
        payments: [],
        rides: [],
        hashPassword: null,
        checkPassword: null,
      };

      orderRepository.findOne.mockResolvedValue(order);

      const result = await service.editOrder(orderSearchSuccessUser, {
        id: 1,
        status: OrderStatus.Cooked,
      });

      expect(orderRepository.save).toHaveBeenCalledTimes(1);
      expect(orderRepository.save).toHaveBeenCalledWith(expect.any(Object));

      expect(result).toEqual({
        ok: true,
      });
    });

    it('주문 상태 변경 실패', async () => {
      orderRepository.findOne.mockRejectedValue(new Error(':('));

      const result = await service.editOrder(user, {
        id: 1,
        status: OrderStatus.Cooking,
      });

      expect(result).toEqual({
        ok: false,
        error: '주문 상태를 변경 할 수 없습니다.',
      });
    });
  });

  describe('Take Order', () => {
    const user = {
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      email: 'test@test.com',
      password: 'test',
      role: UserRole.Delivery,
      verified: false,
      restaurants: [],
      orders: [],
      payments: [],
      rides: [],
      hashPassword: null,
      checkPassword: null,
    };

    it('주문을 찾을 수 없음', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      const result = await service.takeOrder(user, { id: 1 });

      expect(result).toEqual({
        ok: false,
        error: '주문을 찾을수 없습니다 다시한번 확인해주세요',
      });
    });

    it('배달기사 이미 배정 됐을 때', async () => {
      const driverOrder = {
        customerId: 2,
        driverId: 2,
        restaurant: {
          id: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          ownerId: 2,
          name: 'testName',
          coverImage: null,
          address: 'testAddress',
          category: {
            id: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            name: 'testCategoryName',
            coverImage: null,
            slug: 'test',
            restaurants: [],
          },
          owner: createOrderUser,
          orders: [],
          menu: [],
          isPromoted: false,
        },
        items: [],
        status: OrderStatus.Pending,
        id: 1,
        driver: user,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      orderRepository.findOne.mockResolvedValue(driverOrder);

      const result = await service.takeOrder(user, { id: 1 });

      expect(result).toEqual({
        ok: false,
        error: '이미 배달기사가 배정 됐습니다',
      });
    });

    it('배달기사 배정 완료', async () => {
      orderRepository.findOne.mockResolvedValue(order);

      const result = await service.takeOrder(user, { id: 1 });

      expect(orderRepository.save).toHaveBeenCalledTimes(1);
      expect(orderRepository.save).toHaveBeenCalledWith(expect.any(Object));

      expect(result).toEqual({
        ok: true,
      });
    });

    it('배달기사 배정 실패', async () => {
      orderRepository.findOne.mockRejectedValue(new Error(':('));

      const result = await service.takeOrder(user, {
        id: 1,
      });

      expect(result).toEqual({
        ok: false,
        error: '주문 상태를 변경 할 수 없습니다.',
      });
    });
  });
});
