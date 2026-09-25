import { request } from '../request';

/**
 * 管理员登录
 *
 * @param userName 用户名
 * @param password 密码
 */
export async function fetchLogin(userName: string, password: string) {
  const res = await request<{ access_token: string; refresh_token: string }>({
    url: '/auth/admin-login',
    method: 'post',
    data: {
      username: userName,
      password
    }
  });

  // 映射为模板契约 { token, refreshToken }
  if (res.data) {
    res.data = {
      token: res.data.access_token,
      refreshToken: res.data.refresh_token
    } as unknown as typeof res.data;
  }
  return res as unknown as { data: Api.Auth.LoginToken | null; error: any };
}

/** 获取当前管理员信息 */
export function fetchGetUserInfo() {
  return request<Api.Auth.UserInfo>({ url: '/admin/me' });
}

/**
 * 刷新 access token
 *
 * @param refreshToken 刷新令牌
 */
export async function fetchRefreshToken(refreshToken: string) {
  const res = await request<{ access_token: string }>({
    url: '/auth/refresh',
    method: 'post',
    data: {
      refresh_token: refreshToken
    }
  });

  // 后端只签发新 access token，refresh token 保持不变
  if (res.data) {
    res.data = {
      token: res.data.access_token,
      refreshToken
    } as unknown as typeof res.data;
  }
  return res as unknown as { data: Api.Auth.LoginToken | null; error: any };
}

/** 自定义后端错误示例（保留模板方法，未使用） */
export function fetchCustomBackendError(code: string, msg: string) {
  return request({ url: '/auth/error', params: { code, msg } });
}
