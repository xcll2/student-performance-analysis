package com.student.perf.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.student.perf.common.Result;
import com.student.perf.mapper.StudentScoreMapper;
import com.student.perf.pojo.StudentScore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 学生成绩列表接口
 * 测试: http://localhost:8080/api/students?page=1&size=10&course=math&sex=F
 */
@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentScoreMapper mapper;

    // 构造器注入(推荐写法, 比 @Autowired 字段注入更利于测试)
    public StudentController(StudentScoreMapper mapper) {
        this.mapper = mapper;
    }

    /**
     * 分页 + 条件查询
     * 不传条件参数就是查全部, 传了就动态拼接 WHERE
     */
    @GetMapping
    public Result<Page<StudentScore>> list(
            @RequestParam(defaultValue = "1") int page,     // 页码, 从1开始
            @RequestParam(defaultValue = "10") int size,    // 每页条数
            @RequestParam(required = false) String course,  // 科目 math/por
            @RequestParam(required = false) String sex,     // 性别 F/M
            @RequestParam(required = false) String grade) { // 等级 A~F/W

        // 1. 分页对象
        Page<StudentScore> p = new Page<>(page, size);

        // 2. 条件构造器: 参数传了才加 WHERE 条件
        LambdaQueryWrapper<StudentScore> wrapper = new LambdaQueryWrapper<StudentScore>()
                .eq(course != null && !course.isEmpty(), StudentScore::getCourse, course)
                .eq(sex != null && !sex.isEmpty(), StudentScore::getSex, sex)
                .eq(grade != null && !grade.isEmpty(), StudentScore::getGrade, grade)
                .orderByAsc(StudentScore::getId);

        // 3. 一行代码完成 分页+条件查询, SQL 由 MP 自动生成
        return Result.ok(mapper.selectPage(p, wrapper));
    }

    /** 单条详情: http://localhost:8080/api/students/1 */
    @GetMapping("/{id}")
    public Result<StudentScore> detail(@PathVariable Long id) {
        return Result.ok(mapper.selectById(id));
    }
}
