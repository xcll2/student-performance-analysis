package com.student.perf;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 启动入口
 * @MapperScan: 扫描 mapper 包下的接口, 自动生成实现并注册为 Bean
 */
@SpringBootApplication
@MapperScan("com.student.perf.mapper")
public class BackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }
}
