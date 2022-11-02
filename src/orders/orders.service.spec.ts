import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { OrderService } from './orders.service';
import { Dish } from 'src/restaurants/entities/dish.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
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

    it('extra 값이 존재 할 때 주문 성공', async () => {
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
});
