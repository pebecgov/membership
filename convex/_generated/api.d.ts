/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminAuth from "../adminAuth.js";
import type * as associationUtils from "../associationUtils.js";
import type * as associations from "../associations.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as members from "../members.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as viewerAccess from "../viewerAccess.js";
import type * as viewers from "../viewers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminAuth: typeof adminAuth;
  associationUtils: typeof associationUtils;
  associations: typeof associations;
  files: typeof files;
  http: typeof http;
  members: typeof members;
  users: typeof users;
  utils: typeof utils;
  viewerAccess: typeof viewerAccess;
  viewers: typeof viewers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
