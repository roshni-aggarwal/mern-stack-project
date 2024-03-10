//@ts-nocheck
"use server";

import { sql } from "kysely";
import { DEFAULT_PAGE_SIZE } from "../../constant";
import { db } from "../../db";
import { InsertProducts, UpdateProducts, InsertProductCategories } from "@/types";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/utils/authOptions";
import { cache } from "react";

export async function getProducts(pageNo = 1, pageSize = DEFAULT_PAGE_SIZE, sortBy='', brand='',categoryId='',priceRangeTo='', gender='', occasion='', discount='') {
  try {
    let products;
    let dbQuery = db.selectFrom("products").selectAll("products");
    console.log('brands', brand)
    
    if (brand !== '') { 
      const brandIds = brand.split(',').map((id: Number) => parseInt(id)).filter((id: Number) => !isNaN(id));
      dbQuery = dbQuery.where(`CONTAINS('brands', ${brandIds})`)
    }

    if (categoryId !== '') {
      const categoryIds = categoryId.split(',').map((id: Number) => parseInt(id)).filter((id: Number) => !isNaN(id));
      const categoryProductQuery = db.selectFrom("product_categories").select("product_id").where("category_id", "in", categoryIds);
      const categoryProduct = await categoryProductQuery.execute()
      const productIds = categoryProduct.map(row => row.product_id);
      dbQuery = dbQuery.where('id', 'in', productIds)
    }

    if (priceRangeTo !== '') {
      dbQuery = dbQuery.where(sql`price <= ${parseInt(priceRangeTo)}`)
    }

    if (gender !== '') {
      dbQuery = dbQuery.where('gender', '=', gender);
    }

    // if (occasion !== '') {
    //   const occasionArr = occasion.split(',');
    //   dbQuery = dbQuery.where((eb) => {
    //     occasionArr.forEach(occ =>
    //       {
    //         eb.or(sql`FIND_IN_SET(?, occasion'') > 0`, occ);
    //       }
    //     );
    //   });
    // }

    if (discount !== '') {
      const discountArr = discount.split('-').map(dis => parseFloat(dis));
      dbQuery = dbQuery.where(sql`discount BETWEEN '${discountArr[0]}' AND '${discountArr[1]}'`)
    }

    const { count } = await dbQuery
      .select(sql`COUNT(DISTINCT products.id) as count`)
      .executeTakeFirst();

    const lastPage = Math.ceil(count / pageSize);

    dbQuery = dbQuery.distinct().offset((pageNo - 1) * pageSize).limit(pageSize);

    switch (sortBy) {
      case 'price-asc':
        dbQuery = dbQuery.orderBy('price');
        break;
      case 'price-desc':
        dbQuery = dbQuery.orderBy('price', 'desc');
        break;
      case 'created_at-asc':
        dbQuery = dbQuery.orderBy('created_at');
        break;
      case 'created_at-desc':
        dbQuery = dbQuery.orderBy('created_at', 'desc');
        break;
        case 'rating-asc':
          dbQuery = dbQuery.orderBy('rating');
        break;
        case 'rating-desc':
          dbQuery = dbQuery.orderBy('rating', 'desc');
          break;
      default:
        break;
    }

    products = await dbQuery.execute();

    const numOfResultsOnCurPage = products.length;

    return { products, count, lastPage, numOfResultsOnCurPage };
  } catch (error) {
    throw error;
  }
}

export const getProduct = cache(async function getProduct(productId: number) {
  // console.log("run");
  try {
    const product = await db
      .selectFrom("products")
      .selectAll()
      .where("id", "=", productId)
      .execute();

    return product;
  } catch (error) {
    return { error: "Could not find the product" };
  }
});

async function enableForeignKeyChecks() {
  await sql`SET foreign_key_checks = 1`.execute(db);
}

async function disableForeignKeyChecks() {
  await sql`SET foreign_key_checks = 0`.execute(db);
}

export async function deleteProduct(productId: number) {
  try {
    await disableForeignKeyChecks();
    await db
      .deleteFrom("product_categories")
      .where("product_categories.product_id", "=", productId)
      .execute();
    await db
      .deleteFrom("reviews")
      .where("reviews.product_id", "=", productId)
      .execute();

    await db
      .deleteFrom("comments")
      .where("comments.product_id", "=", productId)
      .execute();

    await db.deleteFrom("products").where("id", "=", productId).execute();

    await enableForeignKeyChecks();
    revalidatePath("/products");
    return { message: "success" };
  } catch (error) {
    return { error: "Something went wrong, Cannot delete the product" };
  }
}

export async function MapBrandIdsToName(brandsId) {
  const brandsMap = new Map();
  try {
    for (let i = 0; i < brandsId.length; i++) {
      const brandId = brandsId.at(i);
      const brand = await db
        .selectFrom("brands")
        .select("name")
        .where("id", "=", +brandId)
        .executeTakeFirst();
      brandsMap.set(brandId, brand?.name);
    }
    return brandsMap;
  } catch (error) {
    throw error;
  }
}

export async function getAllProductCategories(products: any) {
  try {
    const productsId = products.map((product) => product.id);
    const categoriesMap = new Map();

    for (let i = 0; i < productsId.length; i++) {
      const productId = productsId.at(i);
      const categories = await db
        .selectFrom("product_categories")
        .innerJoin(
          "categories",
          "categories.id",
          "product_categories.category_id"
        )
        .select("categories.name")
        .where("product_categories.product_id", "=", productId)
        .execute();
      categoriesMap.set(productId, categories);
    }
    return categoriesMap;
  } catch (error) {
    throw error;
  }
}

export async function getProductCategories(productId: number) {
  try {
    const categories = await db
      .selectFrom("product_categories")
      .innerJoin(
        "categories",
        "categories.id",
        "product_categories.category_id"
      )
      .select(["categories.id", "categories.name"])
      .where("product_categories.product_id", "=", productId)
      .execute();

    return categories;
  } catch (error) {
    throw error;
  }
}

export async function addProduct(data: InsertProducts, categories: any[]) {
  try {
    if (!data.brands || !data.colors || !data.description || !data.discount || !data.gender || !data.image_url || !data.occasion || !data.old_price || !data.price || !data.rating) {
      return { error: "All fields are required" };
    }

    const result = await db.insertInto("products").values(data).execute()

    if (result.length !== 0) {
      categories.forEach(cat => {
        const catPayload: InsertProductCategories = {
          category_id: cat,
          created_at: new Date(),
          product_id: result.insertId,
        }
        
        const productCatResult = db.insertInto('product_categories').values(catPayload).execute()
      })
    }
    revalidatePath(`/products`);
  } catch (error) {
    throw (error)
  }
}

export async function editProduct(data: UpdateProducts, categories: any[], id:Number) {
  try {
    if (!data.brands || !data.colors || !data.description || !data.discount || !data.gender || !data.image_url || !data.occasion || !data.old_price || !data.price || !data.rating) {
      return { error: "All fields are required" };
    }

    const result = await db.updateTable("products").set(data).where('id', '=', id).execute()

    if (result.length !== 0) {
      categories.forEach(cat => {
        const catPayload: InsertProductCategories = {
          category_id: cat,
          updated_at: new Date(),
          product_id: id,
        }
        
        const productCatResult = db.updateTable('product_categories').set(catPayload).where('product_id', '=', id).execute()
      })
    }
    revalidatePath(`/products`);
  } catch (error) {
    throw (error)
  }
}
