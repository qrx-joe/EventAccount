import { ApiResponseDto } from './api-response.dto';

describe('ApiResponseDto', () => {
  it('ok() 返回标准成功结构', () => {
    const result = ApiResponseDto.ok({ id: 'u-1' }, '查询成功');

    expect(result.success).toBe(true);
    expect(result.code).toBe(200);
    expect(result.message).toBe('查询成功');
    expect(result.data).toEqual({ id: 'u-1' });
    expect(typeof result.timestamp).toBe('string');
  });

  it('created() 返回 201', () => {
    const result = ApiResponseDto.created({ token: 'jwt-token' }, '创建成功');

    expect(result.success).toBe(true);
    expect(result.code).toBe(201);
    expect(result.message).toBe('创建成功');
    expect(result.data).toEqual({ token: 'jwt-token' });
  });

  it('fail() 返回失败结构', () => {
    const result = ApiResponseDto.fail(401, '未授权');

    expect(result.success).toBe(false);
    expect(result.code).toBe(401);
    expect(result.message).toBe('未授权');
    expect(result.data).toBeNull();
    expect(typeof result.timestamp).toBe('string');
  });
});
