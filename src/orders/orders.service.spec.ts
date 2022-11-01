import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { OrderService } from './orders.service';
import { Dish } from 'src/restaurants/entities/dish.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PUB_SUB } from 'src/common/common.constants';
import { User, UserRole } from 'src/users/entities/user.entity';
import { PubSub } from 'graphql-subscriptions';

const mockRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
});

type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: MockRepository<Order>;
  let orderItemRepository: MockRepository<OrderItem>;
  let restaurantRepository: MockRepository<Restaurant>;
  let dishRepository: MockRepository<Dish>;
  let pubSub: PubSub;

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
          useValue: mockRepository(),
        },
      ],
    }).compile();
    service = module.get<OrderService>(OrderService);
    orderRepository = module.get(getRepositoryToken(Order));
    orderItemRepository = module.get(getRepositoryToken(OrderItem));
    restaurantRepository = module.get(getRepositoryToken(Restaurant));
    dishRepository = module.get(getRepositoryToken(Dish));
    pubSub = module.get(PubSub);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Create Order', () => {
    const createOrderArgs = {
      user: {
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
      },
      input: {
        restaurantId: 1,
        items: [
          {
            dishId: 1,
            options: [{ name: 'testOptions', extra: 7 }],
          },
        ],
      },
    };

    const dishArgs = {
      id: 1,
      name: 'testDish',
      price: 5,
      options: [{ name: 'testOptions', extra: 7 }],
    };

    const newOrderItem = [
      {
        name: 'test',
        choice: 'test',
        extra: 4,
      },
    ];

    it('Restaurant not found', async () => {
      restaurantRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createOrder(
        createOrderArgs.user,
        createOrderArgs.input,
      );

      expect(result).toMatchObject({
        ok: false,
        error: 'Restaurant not found',
      });
    });

    it('Dish not found', async () => {
      restaurantRepository.findOne.mockResolvedValue({ id: 1 });
      dishRepository.findOne.mockResolvedValue(undefined);

      const result = await service.createOrder(
        createOrderArgs.user,
        createOrderArgs.input,
      );

      expect(result).toMatchObject({
        ok: false,
        error: 'Dish not found',
      });
    });

    it.todo('Order Sum Price');
    it.todo('Order Items Save');
    it.todo('Order Save');
  });
});
