/**
 * Foundation migration learning map.
 *
 * <p>{@code backend/app/api/auth.py} functions {@code enter_cds}, {@code login}, {@code me},
 * {@code refresh}, {@code get_impersonation_users}, {@code impersonation_login}, and
 * {@code social_exchange} map to {@link com.vibehr.auth.AuthController} and
 * {@link com.vibehr.auth.AuthService}. Menu functions from {@code backend/app/api/menu.py} map
 * to {@code com.vibehr.menu.MenuController}/{@code MenuPermissionService}; common-code,
 * system-setting, and dashboard functions map to their same-named Spring packages.
 *
 * <p>JPA owns auth lifecycle rows. {@code AuthReferenceMapper} makes organization and HR access
 * explicit without adding a second JPA mapping; its calls remain inside the AuthService transaction.
 */
package com.vibehr.auth;
