package com.student.perf.common;

import lombok.Data;

/**
 * 统一 JSON 返回格式
 * 前端拿到任何接口的响应都是 {code, msg, data}, 处理逻辑统一
 */
@Data
public class Result<T> {
    private Integer code;   // 200=成功, 500=失败
    private String msg;     // 提示信息
    private T data;         // 业务数据

    public static <T> Result<T> ok(T data) {
        Result<T> r = new Result<>();
        r.code = 200;
        r.msg = "success";
        r.data = data;
        return r;
    }

    public static <T> Result<T> error(String msg) {
        Result<T> r = new Result<>();
        r.code = 500;
        r.msg = msg;
        return r;
    }
}
