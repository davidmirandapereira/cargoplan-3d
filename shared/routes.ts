import { z } from 'zod';
import { 
  insertProductSchema, 
  insertBoxTypeSchema,
  insertPalletTypeSchema,
  insertCargoSpaceSchema,
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  products: {
    list: { method: 'GET' as const, path: '/api/products' as const, responses: { 200: z.any() } },
    create: { method: 'POST' as const, path: '/api/products' as const, input: insertProductSchema, responses: { 201: z.any() } },
    update: { method: 'PUT' as const, path: '/api/products/:id' as const, input: insertProductSchema.partial(), responses: { 200: z.any() } },
    delete: { method: 'DELETE' as const, path: '/api/products/:id' as const, responses: { 204: z.void() } },
  },
  boxTypes: {
    list: { method: 'GET' as const, path: '/api/box-types' as const, responses: { 200: z.any() } },
    create: { method: 'POST' as const, path: '/api/box-types' as const, input: insertBoxTypeSchema, responses: { 201: z.any() } },
    update: { method: 'PUT' as const, path: '/api/box-types/:id' as const, input: insertBoxTypeSchema.partial(), responses: { 200: z.any() } },
    delete: { method: 'DELETE' as const, path: '/api/box-types/:id' as const, responses: { 204: z.void() } },
    addProduct: {
      method: 'POST' as const,
      path: '/api/box-types/:id/products' as const,
      input: z.object({ productId: z.number(), quantity: z.number().min(1) }),
      responses: { 201: z.any() },
    },
    removeProduct: {
      method: 'DELETE' as const,
      path: '/api/box-types/:boxTypeId/products/:productId' as const,
      responses: { 204: z.void() },
    },
    getProducts: {
      method: 'GET' as const,
      path: '/api/box-types/:id/products' as const,
      responses: { 200: z.any() },
    },
  },
  palletTypes: {
    list: { method: 'GET' as const, path: '/api/pallet-types' as const, responses: { 200: z.any() } },
    create: { method: 'POST' as const, path: '/api/pallet-types' as const, input: insertPalletTypeSchema, responses: { 201: z.any() } },
    update: { method: 'PUT' as const, path: '/api/pallet-types/:id' as const, input: insertPalletTypeSchema.partial(), responses: { 200: z.any() } },
    delete: { method: 'DELETE' as const, path: '/api/pallet-types/:id' as const, responses: { 204: z.void() } },
    addBox: {
      method: 'POST' as const,
      path: '/api/pallet-types/:id/boxes' as const,
      input: z.object({ boxTypeId: z.number(), quantity: z.number().min(1) }),
      responses: { 201: z.any() },
    },
    removeBox: {
      method: 'DELETE' as const,
      path: '/api/pallet-types/:palletTypeId/boxes/:boxTypeId' as const,
      responses: { 204: z.void() },
    },
    getBoxes: {
      method: 'GET' as const,
      path: '/api/pallet-types/:id/boxes' as const,
      responses: { 200: z.any() },
    },
  },
  cargo: {
    spaces: {
      list: { method: 'GET' as const, path: '/api/cargo/spaces' as const, responses: { 200: z.any() } },
      create: { method: 'POST' as const, path: '/api/cargo/spaces' as const, input: insertCargoSpaceSchema, responses: { 201: z.any() } },
      update: { method: 'PUT' as const, path: '/api/cargo/spaces/:id' as const, input: insertCargoSpaceSchema.partial(), responses: { 200: z.any() } },
      delete: { method: 'DELETE' as const, path: '/api/cargo/spaces/:id' as const, responses: { 204: z.void() } },
    },
    calculate: {
      method: 'POST' as const,
      path: '/api/cargo/calculate' as const,
      input: z.object({
        spaceId: z.number().optional(),
        category: z.enum(["container", "truck"]).optional(),
        items: z.array(z.object({
          type: z.enum(["pallet", "box", "product"]),
          id: z.number(),
          quantity: z.number().min(1),
        })),
      }),
      responses: { 200: z.any() },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
