import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RestaurantService } from './restaurants.service';
import { Restaurant } from './entities/restaurant.entity';
import { Dish } from './entities/dish.entity';
import { CategoryRepository } from './repositories/category.repository';
import { Repository } from 'typeorm';
import { UserRole } from 'src/users/entities/user.entity';

const mockRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
});

const restaurantUser = {
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

const restaurants = [
  {
    id: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    name: 'testRestaurants',
    coverImage: null,
    address: 'testAddress',
    isPromoted: false,
    promotedUntil: null,
    category: [],
    owner: [],
    ownerId: 1,
  },
];

type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('Restaurants Service', () => {
  let service: RestaurantService;
  let categoryRepository: CategoryRepository;
  let restaurantRepository: MockRepository<Restaurant>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RestaurantService,
        CategoryRepository,
        {
          provide: getRepositoryToken(Restaurant),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Dish),
          useValue: mockRepository(),
        },
      ],
    }).compile();
    service = module.get<RestaurantService>(RestaurantService);
    categoryRepository = module.get<CategoryRepository>(CategoryRepository);
    restaurantRepository = module.get(getRepositoryToken(Restaurant));
  });

  it('Should be defiend', () => {
    expect(service).toBeDefined();
  });

  describe('Create Restaurant', () => {
    const createRestaurantInputArgs = {
      id: 1,
      name: 'test',
      coverImage: 'test',
      address: 'test',
      categoryName: 'test',
    };
    const categoryArgs = {
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: 'testrestaurant',
      coverImage: null,
      slug: 'testrestaurant',
      restaurants: [],
    };

    it('새로운 음식점 등록 성공', async () => {
      restaurantRepository.create.mockReturnValue(createRestaurantInputArgs);
      jest
        .spyOn(categoryRepository, 'getOrCreate')
        .mockResolvedValue(categoryArgs);

      const result = await service.createRestaurant(
        restaurantUser,
        createRestaurantInputArgs,
      );

      expect(restaurantRepository.save).toHaveBeenCalledTimes(1);
      expect(restaurantRepository.save).toHaveBeenCalledWith(
        expect.any(Object),
      );

      expect(categoryRepository.getOrCreate).toHaveBeenCalledTimes(1);
      expect(restaurantRepository.save).toHaveBeenCalledWith(
        expect.any(Object),
      );

      expect(result).toEqual({
        ok: true,
        restaurantId: 1,
      });
    });

    it('새로운 음식점 등록 실패', async () => {
      restaurantRepository.create.mockResolvedValue(undefined);
      const result = await service.createRestaurant(
        restaurantUser,
        createRestaurantInputArgs,
      );

      expect(result).toEqual({
        ok: false,
        error: '음식점을 생성할 수 없습니다',
      });
    });
  });

  describe('Edit Restaurant', () => {
    const categoryArgs = {
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: 'testrestaurant',
      coverImage: null,
      slug: 'testrestaurant',
      restaurants: [],
    };
    const editRestaurantInputArgs = {
      id: 1,
      name: 'test',
      coverImage: 'test',
      address: 'test',
      categoryName: 'test',
      restaurantId: 1,
    };

    it('음식점이 존재하지 않을때', async () => {
      restaurantRepository.findOne.mockResolvedValue(null);
      const result = await service.editRestaurant(
        restaurantUser,
        editRestaurantInputArgs,
      );

      expect(result).toEqual({
        ok: false,
        error: '음식점을 찾을 수 없습니다.',
      });
    });

    it('음식점 주인이 아닐때', async () => {
      restaurantRepository.findOne.mockResolvedValue({ ownerId: 2 });
      const result = await service.editRestaurant(
        restaurantUser,
        editRestaurantInputArgs,
      );

      expect(result).toEqual({
        ok: false,
        error: '음식점 주인이 아니므로 수정할 수 없습니다.',
      });
    });

    it('음식점 정보 변경 성공', async () => {
      const oldRestaurant = {
        ownerId: 1,
        restaurantId: 1,
        name: 'oldTest',
        coverImage: null,
        address: 'oldTestAddress',
        categoryName: 'oldTestCategoryName',
      };

      restaurantRepository.findOne.mockResolvedValue(oldRestaurant);

      jest
        .spyOn(categoryRepository, 'getOrCreate')
        .mockResolvedValue(categoryArgs);

      const result = await service.editRestaurant(
        restaurantUser,
        editRestaurantInputArgs,
      );

      expect(categoryRepository.getOrCreate).toHaveBeenCalledTimes(1);

      expect(restaurantRepository.save).toHaveBeenCalledTimes(1);
      expect(restaurantRepository.save).toHaveBeenCalledWith(
        expect.any(Object),
      );

      expect(result).toEqual({ ok: true });
    });

    it('음식점 정보 변경 실패', async () => {
      restaurantRepository.findOne.mockRejectedValue(new Error(':)'));

      const result = await service.editRestaurant(
        restaurantUser,
        editRestaurantInputArgs,
      );

      expect(result).toEqual({
        ok: false,
      });
    });
  });

  describe('Delete Restaurant', () => {
    const testId = { restaurantId: 1 };
    it('음식점이 존재하지 않을때', async () => {
      restaurantRepository.findOne.mockResolvedValue(null);
      const result = await service.deleteRestaurant(restaurantUser, testId);

      expect(result).toEqual({
        ok: false,
        error: '음식점을 찾을 수 없습니다.',
      });
    });

    it('음식점 주인이 아닐때', async () => {
      restaurantRepository.findOne.mockResolvedValue({ ownerId: 2 });
      const result = await service.deleteRestaurant(restaurantUser, testId);

      expect(result).toEqual({
        ok: false,
        error: '음식점 주인이 아니므로 삭제할 수 없습니다.',
      });
    });

    it('음식점 삭제 성공', async () => {
      restaurantRepository.findOne.mockResolvedValue({ ownerId: 1 });
      const result = await service.deleteRestaurant(restaurantUser, testId);

      expect(restaurantRepository.delete).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        ok: true,
      });
    });

    it('음식점 삭제 실패', async () => {
      restaurantRepository.findOne.mockRejectedValue(new Error(':)'));
      const result = await service.deleteRestaurant(restaurantUser, testId);
      expect(result).toEqual({
        ok: false,
        error: '음식점을 삭제 할 수 없습니다.',
      });
    });
  });

  describe('Get All Categories & Categories Count', () => {
    const categories = [
      {
        id: 1,
        name: 'category1',
        coverImage: null,
        slug: 'category1',
        restaurants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        name: 'category2',
        coverImage: null,
        slug: 'category2',
        restaurants: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('카테고리 불러오기 성공', async () => {
      jest.spyOn(categoryRepository, 'find').mockResolvedValue(categories);
      const result = await service.allCategories();

      expect(result).toEqual({
        ok: true,
        categories,
      });
    });

    it('카테고리 불러오기 실패', async () => {
      jest.spyOn(categoryRepository, 'find').mockRejectedValue(new Error(':)'));
      const result = await service.allCategories();
      expect(result).toEqual({
        ok: false,
        error: '카테고리를 못 가져왔습니다.',
      });
    });

    it('카테고리 갯수', async () => {
      restaurantRepository.count.mockResolvedValue({ totalResults: 1 });
      const result = await service.countRestaurants(categories[0]);

      expect(result).toEqual({ totalResults: 1 });
    });
  });

  describe('Find Category By Slug', () => {
    const categoryTestInput = {
      slug: 'category',
      page: 1,
    };
    const category = {
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: 'testName',
      coverImage: null,
      slug: 'testSlug',
      restaurants: [],
    };
    const restaurants = [
      {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        name: 'testRestaurantName',
        coverImage: null,
        address: '강남',
        isPromoted: false,
        promotedUntil: null,
      },
    ];

    it('카테고리를 찾을 수 없을때', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(null);
      const result = await service.findCategoryBySlug(categoryTestInput);

      expect(result).toEqual({
        ok: false,
        error: '카테고리를 찾을 수 없습니다.',
      });
    });

    it('카테고리 검색 성공', async () => {
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(category);
      restaurantRepository.count.mockResolvedValue(restaurants.length);
      restaurantRepository.find.mockResolvedValue(restaurants);

      const result = await service.findCategoryBySlug(categoryTestInput);

      expect(result).toEqual({
        ok: true,
        category,
        restaurants,
        totalPages: Math.ceil(restaurants.length / 25),
        totalResults: restaurants.length,
      });
    });

    it('카테고리 검색 실패', async () => {
      jest
        .spyOn(categoryRepository, 'findOne')
        .mockRejectedValue(new Error(':)'));

      const result = await service.findCategoryBySlug(categoryTestInput);

      expect(result).toEqual({
        ok: false,
        error: '카테고리를 가져올 수 없습니다.',
      });
    });
  });

  describe('Get All Restaurants', () => {
    it('모든 음식점 검색 성공', async () => {
      restaurantRepository.findAndCount.mockResolvedValue([
        [...restaurants],
        restaurants.length,
      ]);

      const result = await service.allRestaurants({ page: 1 });
      expect(result).toEqual({
        ok: true,
        results: restaurants,
        totalPages: Math.ceil(restaurants.length / 3),
        totalResults: restaurants.length,
      });
    });

    it('모든 음식점 검색 실패', async () => {
      restaurantRepository.findAndCount.mockRejectedValue(new Error(':)'));

      const result = await service.allRestaurants({ page: 1 });

      expect(result).toEqual({
        ok: false,
        error: '음식점을 불러올 수 없습니다.',
      });
    });
  });

  describe('Get My Restaurants', () => {
    const myRestaurants = [
      {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        name: 'testMyRestaurants',
        coverImage: null,
        address: 'testMyAddress',
        isPromoted: false,
        promotedUntil: null,
        category: [],
        owner: [],
        ownerId: 1,
      },
    ];
    it('내 음식점 검색 성공', async () => {
      restaurantRepository.find.mockResolvedValue(myRestaurants);

      const result = await service.myRestaurants(restaurantUser);

      expect(result).toEqual({
        ok: true,
        restaurants: myRestaurants,
      });
    });

    it('내 음식점 검색 실패', async () => {
      restaurantRepository.find.mockRejectedValue(new Error(':)'));

      const result = await service.myRestaurants(restaurantUser);

      expect(result).toEqual({
        ok: false,
        error: '음식점을 찾을 수 없습니다.',
      });
    });
  });

  describe('Find One My restaurant', () => {
    const myRestaurants = {
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: 'testMyRestaurants',
      coverImage: null,
      address: 'testMyAddress',
      isPromoted: false,
      promotedUntil: null,
      category: [],
      owner: [],
      ownerId: 1,
    };

    it('내 음식점 한개 검색 성공', async () => {
      restaurantRepository.findOne.mockResolvedValue(myRestaurants);
      const result = await service.findOneMyRestaurant(restaurantUser, {
        id: myRestaurants.id,
      });

      expect(result).toEqual({
        ok: true,
        restaurant: myRestaurants,
      });
    });

    it('내 음식점 검색 한개 검색 실패', async () => {
      restaurantRepository.findOne.mockRejectedValue(new Error(':)'));
      const result = await service.findOneMyRestaurant(restaurantUser, {
        id: myRestaurants.id,
      });

      expect(result).toEqual({
        ok: false,
        error: '음식점을 찾을 수 없습니다.',
      });
    });
  });

  describe('Find Restaurant By Id', () => {
    const restaurant = {
      id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: 'testRestaurants',
      coverImage: null,
      address: 'testAddress',
      isPromoted: false,
      promotedUntil: null,
      category: [],
      owner: [],
      ownerId: 1,
    };

    it('음식점을 찾지 못했을 때', async () => {
      restaurantRepository.findOne.mockResolvedValue(null);

      const result = await service.findRestaurantById({
        restaurantId: restaurant.id,
      });

      expect(result).toEqual({
        ok: false,
        error: '찾는 음식점이 없습니다.',
      });
    });

    it('음식점 검색 성공', async () => {
      restaurantRepository.findOne.mockResolvedValue(restaurant);

      const result = await service.findRestaurantById({
        restaurantId: restaurant.id,
      });

      expect(result).toEqual({
        ok: true,
        restaurant,
      });
    });

    it('음식점 검색 실패', async () => {
      restaurantRepository.findOne.mockRejectedValue(new Error(':)'));

      const result = await service.findRestaurantById({
        restaurantId: restaurant.id,
      });

      expect(result).toEqual({
        ok: false,
        error: '음식점을 찾을 수 없습니다.',
      });
    });
  });

  describe('Search Restaurant By Name', () => {
    it('음식점 이름으로 검색 성공', async () => {
      restaurantRepository.findAndCount.mockResolvedValue([
        [...restaurants],
        restaurants.length,
      ]);

      const result = await service.searchRestaurantByName({
        query: 'rest',
        page: 1,
      });

      expect(result).toEqual({
        ok: true,
        restaurants,
        totalResults: restaurants.length,
        totalPages: Math.ceil(restaurants.length / 25),
      });
    });

    it('음식점 이름으로 검색 실패', async () => {
      restaurantRepository.findAndCount.mockRejectedValue(new Error(':)'));

      const result = await service.searchRestaurantByName({
        query: 'rest',
        page: 1,
      });

      expect(result).toEqual({
        ok: false,
        error: '음식점을 검색 할 수 없습니다.',
      });
    });
  });
});
