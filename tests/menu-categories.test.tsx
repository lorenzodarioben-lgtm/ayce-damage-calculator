import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryTabs, visibleCategories } from '@/components/meal/CategoryTabs';
import { FoodIllustration } from '@/components/meal/FoodIllustration';
import { FOODS } from '@/data/foods';
import { buildHistoryAnalytics } from '@/lib/analytics';
import { buildDamageReport, calculateLineItem } from '@/lib/calculations';
import {
  CATEGORY_META,
  CUSTOM_ONLY_CATEGORIES,
  FOOD_CATEGORIES,
  GRILL_CATEGORIES,
} from '@/lib/constants';
import { createCustomFood, parseCustomFood } from '@/lib/customFoods';
import { foodCatalogue, searchFoodCatalogue, foodsInCatalogueCategory } from '@/lib/foodCatalogue';
import { sortFoods } from '@/data/foods';
import { createSavedSession, parseSavedSession } from '@/lib/history';
import { decodeMenuPayload, encodeMenuPayload } from '@/lib/menuShare';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { getVerdict } from '@/lib/verdicts';
import { CUSTOM_FOOD_VARIANT_BY_CATEGORY } from '@/types/customFoods';
import type { CustomFood } from '@/types/customFoods';
import type { FoodCategory, MealItem, MealSession } from '@/types/meal';

const KIMCHI: CustomFood = createCustomFood(
  {
    name: 'Kimchi',
    category: 'sides',
    retailPricePerKg: 18,
    restaurantCostPerKg: 6,
    caloriesPer100g: 30,
    proteinPer100g: 2,
    fatPer100g: 0.5,
    carbsPer100g: 4,
  },
  'custom-food-kimchi',
)!;

const STEW: CustomFood = createCustomFood(
  {
    name: 'Doenjang jjigae',
    category: 'hot-food',
    valuation: 'by-serving',
    retailPricePerServing: 11,
    restaurantCostPerServing: 3.5,
    gramsPerServing: 380,
  },
  'custom-food-doenjang-jjigae',
)!;

const ICE_CREAM: CustomFood = createCustomFood(
  {
    name: 'Green tea ice cream',
    category: 'desserts',
    valuation: 'by-serving',
    retailPricePerServing: 6,
    restaurantCostPerServing: 1.8,
  },
  'custom-food-green-tea-ice-cream',
)!;

const BEER: CustomFood = createCustomFood(
  {
    name: 'House lager',
    category: 'drinks',
    valuation: 'by-serving',
    retailPricePerServing: 9,
    restaurantCostPerServing: 2.5,
  },
  'custom-food-house-lager',
)!;

const PERSONAL = [KIMCHI, STEW, ICE_CREAM, BEER];

function line(foodId: string, quantity = 1): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
  };
}

describe('The bundled catalogue is untouched', () => {
  it('still holds exactly the eighteen grill cuts', () => {
    expect(FOODS).toHaveLength(18);
    for (const food of FOODS) {
      expect(GRILL_CATEGORIES).toContain(food.category);
    }
  });

  it('bundles nothing in the four new categories', () => {
    for (const category of CUSTOM_ONLY_CATEGORIES) {
      expect(foodsInCatalogueCategory(FOODS, category)).toEqual([]);
    }
  });

  it('names all eight categories exactly once', () => {
    expect(CATEGORY_META.map((entry) => entry.id)).toEqual([...FOOD_CATEGORIES]);
    expect(new Set(FOOD_CATEGORIES).size).toBe(FOOD_CATEGORIES.length);
  });
});

describe('A personal item in a new category', () => {
  it.each(CUSTOM_ONLY_CATEGORIES)('can be created in %s', (category) => {
    const food = createCustomFood(
      {
        name: 'Something',
        category: category as FoodCategory,
        retailPricePerKg: 10,
        restaurantCostPerKg: 3,
      },
      'custom-food-something',
    );

    expect(food?.category).toBe(category);
    expect(food?.visualVariant).toBe(CUSTOM_FOOD_VARIANT_BY_CATEGORY[category as FoodCategory]);
  });

  it('joins the catalogue and is found by category', () => {
    const catalogue = foodCatalogue(PERSONAL);

    expect(foodsInCatalogueCategory(catalogue, 'sides').map((food) => food.id)).toEqual([
      KIMCHI.id,
    ]);
    expect(foodsInCatalogueCategory(catalogue, 'drinks').map((food) => food.id)).toEqual([BEER.id]);
  });

  it('is findable by search', () => {
    const catalogue = foodCatalogue(PERSONAL);
    expect(searchFoodCatalogue(catalogue, 'lager').map((food) => food.id)).toContain(BEER.id);
    expect(searchFoodCatalogue(catalogue, 'kimchi').map((food) => food.id)).toContain(KIMCHI.id);
  });

  it('sorts alongside the grill by what one unit is worth', () => {
    const sorted = sortFoods(foodCatalogue(PERSONAL), 'value');
    expect(sorted).toHaveLength(FOODS.length + PERSONAL.length);
    // Stable and total: nothing is dropped and nothing is duplicated.
    expect(new Set(sorted.map((food) => food.id)).size).toBe(sorted.length);
  });

  it('calculates without inventing anything it was not told', () => {
    const totals = calculateLineItem(line(BEER.id, 2), BEER);

    expect(totals.retailValue).toBe(18);
    expect(totals.hasWeight).toBe(false);
    expect(totals.hasNutrition).toBe(false);
    expect(totals.nutrition.calories).toBe(0);
  });
});

describe('Unknown nutrition is not zero nutrition', () => {
  it('reports an item with no macros as unrecorded', () => {
    expect(calculateLineItem(line(STEW.id), STEW).hasNutrition).toBe(false);
  });

  it('reports an item with macros as recorded', () => {
    expect(calculateLineItem(line(KIMCHI.id), KIMCHI).hasNutrition).toBe(true);
  });

  it('counts the lines it could not total, rather than quietly adding zero', () => {
    const report = buildDamageReport(
      [line('beef-ribeye'), line(STEW.id), line(BEER.id)],
      { pricePerDiner: 50, dinerCount: 1 },
      DEFAULT_PRICING_PROFILE,
      foodCatalogue(PERSONAL),
    );

    expect(report.linesWithoutNutrition).toBe(2);
    // The ribeye's macros are still counted; only the unknowns are left out.
    expect(report.nutrition.calories).toBeGreaterThan(0);
  });

  it('reports nothing missing for an ordinary grill meal', () => {
    const report = buildDamageReport([line('beef-ribeye')], { pricePerDiner: 50, dinerCount: 1 });
    expect(report.linesWithoutNutrition).toBe(0);
  });

  it('keeps a zero someone actually typed', () => {
    const zeroed = createCustomFood(
      {
        name: 'Plain water',
        category: 'drinks',
        valuation: 'by-serving',
        retailPricePerServing: 1,
        restaurantCostPerServing: 0.1,
        caloriesPerServing: 0,
        proteinPerServing: 0,
        fatPerServing: 0,
        carbsPerServing: 0,
      },
      'custom-food-plain-water',
    )!;

    // Zero calories is a claim someone made, and it is respected as one.
    expect(calculateLineItem(line(zeroed.id), zeroed).hasNutrition).toBe(true);
  });

  it('survives storage without turning unknown into zero', () => {
    const parsed = parseCustomFood(JSON.parse(JSON.stringify(STEW)));
    expect(parsed).toEqual(STEW);
    expect(parsed?.valuation === 'by-serving' ? parsed.caloriesPerServing : 1).toBeUndefined();
  });
});

describe('Category tabs offer only what exists', () => {
  it('shows the four grill categories on the default menu', () => {
    expect(visibleCategories(FOODS).map((entry) => entry.id)).toEqual([...GRILL_CATEGORIES]);
  });

  it('adds a category once the diner has put something in it', () => {
    const shown = visibleCategories(foodCatalogue([BEER])).map((entry) => entry.id);
    expect(shown).toEqual([...GRILL_CATEGORIES, 'drinks']);
  });

  it('renders a tab per visible category and no more', () => {
    render(
      <CategoryTabs
        value="beef"
        onChange={vi.fn()}
        panelId="panel"
        foods={foodCatalogue([BEER])}
      />,
    );

    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: /Drinks/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Desserts/ })).not.toBeInTheDocument();
  });

  it('wraps arrow-key navigation around the visible tabs only', async () => {
    const onChange = vi.fn();
    render(
      <CategoryTabs
        value="drinks"
        onChange={onChange}
        panelId="panel"
        foods={foodCatalogue([BEER])}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /Drinks/ }));
    onChange.mockClear();
    await user.keyboard('{ArrowRight}');

    // Wraps to the first tab rather than stepping into a category with no food.
    expect(onChange).toHaveBeenCalledWith('beef');
  });
});

describe('Artwork', () => {
  it.each(CUSTOM_ONLY_CATEGORIES)('draws its own arrangement for %s', (category) => {
    const food = PERSONAL.find((entry) => entry.category === category)!;
    const { container } = render(<FoodIllustration food={food} />);

    // Category artwork, not the neutral custom plate: a side is three bowls,
    // and that is a truthful thing to draw without inventing which side.
    expect(container.querySelector('[data-custom-food-artwork]')).toBeNull();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('keeps the neutral plate for a custom cut in a grill category', () => {
    const cut = createCustomFood(
      { name: 'House brisket', category: 'beef', retailPricePerKg: 30, restaurantCostPerKg: 12 },
      'custom-food-house-brisket',
    )!;
    const { container } = render(<FoodIllustration food={cut} />);

    expect(container.querySelector('[data-custom-food-artwork]')).toBeInTheDocument();
  });
});

describe('The new categories travel with everything else', () => {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 50,
    dinerCount: 1,
    pricingProfileId: 'australian-kbbq',
    items: [line('beef-ribeye'), line(BEER.id, 2)],
  };

  it('is analysed under its own category', () => {
    const report = buildDamageReport(
      session.items,
      session,
      DEFAULT_PRICING_PROFILE,
      foodCatalogue(PERSONAL),
    );
    const record = createSavedSession(
      session,
      report,
      getVerdict(report.totalRetailValue, report.totalAdmission),
      { id: 'rec-1', createdAt: '2026-08-16T12:00:00.000Z', customFoods: PERSONAL },
    );
    const analytics = buildHistoryAnalytics([parseSavedSession(record)!]);
    const drinks = analytics.categories.find((entry) => entry.id === 'drinks');

    expect(drinks?.plates).toBe(2);
    expect(analytics.categories.map((entry) => entry.id)).toEqual([...FOOD_CATEGORIES]);
  });

  it('is filed and read back intact', () => {
    const report = buildDamageReport(
      session.items,
      session,
      DEFAULT_PRICING_PROFILE,
      foodCatalogue(PERSONAL),
    );
    const parsed = parseSavedSession(
      createSavedSession(
        session,
        report,
        getVerdict(report.totalRetailValue, report.totalAdmission),
        { id: 'rec-1', createdAt: '2026-08-16T12:00:00.000Z', customFoods: PERSONAL },
      ),
    );

    expect(parsed?.customFoods.find((food) => food.id === BEER.id)?.category).toBe('drinks');
  });

  it('travels in a shared menu link', () => {
    const token = encodeMenuPayload({
      pricingProfile: DEFAULT_PRICING_PROFILE,
      customFoods: PERSONAL,
    })!;
    const decoded = decodeMenuPayload(token);

    expect(decoded?.customFoods.map((food) => food.category)).toEqual([
      'sides',
      'hot-food',
      'desserts',
      'drinks',
    ]);
  });
});
