/* =====================================================================
 * 学生成绩大屏 —— 数据获取与图表渲染
 * 数据链路: MySQL -> Spring Boot(/api/**) -> fetch -> ECharts
 * ===================================================================== */

// 同源部署时用相对路径; 用 file:// 直接打开时回退到 8080
const API_BASE = location.protocol.startsWith("http") ? "" : "http://localhost:8080";

const T = "#c9d8f7";                 // 主文字色
const AXIS = { color: T, fontSize: 11 };
const SPLIT = { lineStyle: { color: "rgba(90,130,220,.16)" } };
const TOOLTIP = {
    backgroundColor: "rgba(10,20,48,.92)",
    borderColor: "rgba(90,140,235,.45)",
    textStyle: { color: "#dbe6ff", fontSize: 12 }
};
const COLORS = { math: "#4d9bff", por: "#2fd6b4" };
const COURSES = ["math", "por"];
const CN = { math: "数学", por: "葡语" };
const GRADES = ["A", "B", "C", "D", "F", "W"];
const GRADE_CN = { A: "优秀 A", B: "良好 B", C: "中等 C", D: "及格 D", F: "不及格 F", W: "缺考 W" };
const GRADE_COLOR = ["#2fd6b4", "#4d9bff", "#f7c948", "#ff9f5a", "#ff6b81", "#7b86a8"];

/* ---------- 工具 ---------- */
// 带超时的请求: 防止浏览器复用失效 keep-alive 连接导致 fetch 永久挂起
async function api(path) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const res = await fetch(API_BASE + path, { signal: ctrl.signal });
        const json = await res.json();
        if (json.code !== 200) throw new Error(json.msg);
        return json.data;
    } finally {
        clearTimeout(timer);
    }
}
const charts = [];
const chartMap = {};   // 按容器缓存实例, 数据变化后刷新复用, 不重复 init
function reg(id) {
    if (!chartMap[id]) {
        chartMap[id] = echarts.init(document.getElementById(id));
        charts.push(chartMap[id]);
    }
    return chartMap[id];
}
window.addEventListener("resize", () => charts.forEach(c => c.resize()));

/** 科目系列工厂: 每个科目一个同结构系列 */
function courseSeries(data, type, valueKey, extra = {}) {
    return COURSES.map(c => ({
        name: CN[c],
        type,
        data: data.filter(d => d.course === c).map(d => d[valueKey]),
        itemStyle: { color: COLORS[c] },
        ...extra
    }));
}

/* ---------- 时钟 ---------- */
function tick() {
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    document.getElementById("clock").textContent =
        `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
setInterval(tick, 1000); tick();

/* ---------- KPI ---------- */
function renderKpi(overview, grades, bothCount) {
    const math = overview.find(o => o.course === "math");
    const por = overview.find(o => o.course === "por");
    const total = overview.reduce((s, o) => s + o.cnt, 0);
    const withdrawn = grades.filter(g => g.label === "W").reduce((s, g) => s + g.cnt, 0);
    const passRate = overview.reduce((s, o) => s + o.passRate * o.cnt, 0) / total;

    const items = [
        { num: total, name: "成绩记录总数" },
        { num: math.avgG3, name: "数学期末均分" },
        { num: por.avgG3, name: "葡语期末均分" },
        { num: (passRate * 100).toFixed(1) + "%", name: "总体及格率" },
        { num: bothCount, name: "两门课双修人数" },
        { num: withdrawn, name: "缺考记录", cls: "rose" },
    ];
    document.getElementById("kpiRow").innerHTML = items.map(i =>
        `<div class="kpi"><div class="num ${i.cls || ""}">${i.num}</div><div class="name">${i.name}</div></div>`
    ).join("");
}

/* ---------- 1. 科目均分 ---------- */
function renderAvg(overview) {
    reg("chartAvg").setOption({
        tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { left: 38, right: 16, top: 22, bottom: 20 },
        xAxis: {
            type: "category", data: COURSES.map(c => CN[c]),
            axisLabel: { ...AXIS, fontSize: 13 },
            axisLine: { lineStyle: { color: "rgba(90,130,220,.35)" } }
        },
        yAxis: { type: "value", max: 20, name: "均分", nameTextStyle: { color: T, fontSize: 11 }, axisLabel: AXIS, splitLine: SPLIT },
        series: [{
            type: "bar", barWidth: 58,
            data: COURSES.map(c => ({
                value: overview.find(x => x.course === c).avgG3,
                itemStyle: {
                    borderRadius: [4, 4, 0, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: c === "math" ? "#7fb8ff" : "#5ce9cb" },
                        { offset: 1, color: c === "math" ? "rgba(77,155,255,.2)" : "rgba(47,214,180,.18)" }
                    ])
                }
            })),
            label: { show: true, position: "top", color: "#e6f0ff", fontSize: 14, formatter: "{c} 分" }
        }]
    });
}

/* ---------- 2. 等级分布(堆积) ---------- */
function renderGrade(grades) {
    const opt = {
        tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "shadow" } },
        legend: { top: 0, textStyle: { color: T, fontSize: 10.5 }, itemWidth: 10, itemHeight: 7, itemGap: 10 },
        grid: { left: 36, right: 14, top: 30, bottom: 22 },
        xAxis: { type: "category", data: COURSES.map(c => CN[c]), axisLabel: AXIS, axisLine: { lineStyle: { color: "rgba(90,130,220,.35)" } } },
        yAxis: { type: "value", name: "人数", nameTextStyle: { color: T, fontSize: 11 }, axisLabel: AXIS, splitLine: SPLIT },
        series: GRADES.map((g, i) => ({
            name: GRADE_CN[g], type: "bar", stack: "g", barWidth: 62,
            itemStyle: { color: GRADE_COLOR[i] },
            emphasis: { focus: "series" },
            label: {
                show: true, color: "#0a1024", fontSize: 11, fontWeight: 600,
                formatter: p => p.value >= 25 ? p.value : ""
            },
            data: COURSES.map(c => {
                const row = grades.find(x => x.course === c && x.label === g);
                return row ? row.cnt : 0;
            })
        }))
    };
    reg("chartGrade").setOption(opt);
}

/* ---------- 3. 及格率(环形) ---------- */
function renderPass(overview) {
    const total = overview.reduce((s, o) => s + o.cnt, 0);
    const overall = overview.reduce((s, o) => s + o.passRate * o.cnt, 0) / total;
    reg("chartPass").setOption({
        tooltip: { ...TOOLTIP, trigger: "item", formatter: "{b}<br/>及格率 {c}%" },
        legend: { bottom: 0, textStyle: { color: T, fontSize: 10.5 }, itemWidth: 10, itemHeight: 7, itemGap: 14 },
        title: {
            text: (overall * 100).toFixed(1) + "%",
            subtext: "总体及格率",
            left: "center", top: "30%",
            textStyle: { color: "#7fe3ff", fontSize: 22, fontWeight: 700 },
            subtextStyle: { color: "#7c8cba", fontSize: 11 }
        },
        series: [{
            type: "pie",
            radius: ["38%", "56%"],
            center: ["50%", "40%"],
            avoidLabelOverlap: true,
            label: { color: T, fontSize: 11, formatter: "{b}\n{c}%" },
            labelLine: { length: 6, length2: 6, lineStyle: { color: "rgba(120,160,240,.5)" } },
            data: COURSES.map(c => {
                const o = overview.find(x => x.course === c);
                return {
                    name: CN[c],
                    value: +(o.passRate * 100).toFixed(1),
                    itemStyle: { color: COLORS[c], borderColor: "#060b1f", borderWidth: 2 }
                };
            })
        }]
    });
}

/* ---------- 4. 分数段结构 ---------- */
function renderDistribution(dist) {
    const bands = ["0-5分", "6-9分", "10-13分", "14-16分", "17-20分"];
    reg("chartDist").setOption({
        tooltip: { ...TOOLTIP, trigger: "axis", axisPointer: { type: "shadow" } },
        legend: { top: 0, textStyle: { color: T, fontSize: 10.5 }, itemWidth: 10, itemHeight: 7, itemGap: 10 },
        grid: { left: 36, right: 12, top: 30, bottom: 22 },
        xAxis: { type: "category", data: bands, axisLabel: { ...AXIS, interval: 0 }, axisLine: { lineStyle: { color: "rgba(90,130,220,.35)" } } },
        yAxis: { type: "value", name: "人数", nameTextStyle: { color: T, fontSize: 11 }, axisLabel: AXIS, splitLine: SPLIT },
        series: COURSES.map(c => ({
            name: CN[c], type: "bar", barWidth: 22, barGap: "20%",
            itemStyle: {
                borderRadius: [3, 3, 0, 0],
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: c === "math" ? "#6fb1ff" : "#4ee3c4" },
                    { offset: 1, color: c === "math" ? "rgba(77,155,255,.18)" : "rgba(47,214,180,.16)" }
                ])
            },
            data: bands.map(b => {
                const row = dist.find(x => x.course === c && x.label === b);
                return row ? row.cnt : 0;
            })
        }))
    });
}

/* ---------- 5. 性别对比(柱 + 及格率线) ---------- */
function renderSex(data) {
    const labels = ["F", "M"];
    const nameMap = { F: "女生", M: "男生" };
    reg("chartSex").setOption({
        tooltip: { ...TOOLTIP, trigger: "axis" },
        legend: { top: 0, textStyle: { color: T, fontSize: 10.5 }, itemWidth: 10, itemHeight: 7, itemGap: 10 },
        grid: { left: 36, right: 40, top: 30, bottom: 22 },
        xAxis: { type: "category", data: labels.map(l => nameMap[l]), axisLabel: AXIS, axisLine: { lineStyle: { color: "rgba(90,130,220,.35)" } } },
        yAxis: [
            { type: "value", max: 20, name: "均分", nameTextStyle: { color: T, fontSize: 11 }, axisLabel: AXIS, splitLine: SPLIT },
            { type: "value", max: 1, name: "及格率", nameTextStyle: { color: T, fontSize: 11 }, axisLabel: { ...AXIS, formatter: v => (v * 100) + "%" }, splitLine: { show: false } }
        ],
        series: [
            ...COURSES.map(c => ({
                name: CN[c] + "均分", type: "bar", barWidth: 20,
                itemStyle: { borderRadius: [3, 3, 0, 0], color: COLORS[c] },
                data: labels.map(l => {
                    const row = data.find(d => d.label === l && d.course === c);
                    return row ? row.avgG3 : 0;
                })
            })),
            ...COURSES.map(c => ({
                name: CN[c] + "及格率", type: "line", yAxisIndex: 1, smooth: true, symbolSize: 6,
                lineStyle: { width: 2, type: "dashed", color: COLORS[c] },
                itemStyle: { color: COLORS[c] },
                data: labels.map(l => {
                    const row = data.find(d => d.label === l && d.course === c);
                    return row ? row.passRate : 0;
                })
            }))
        ]
    });
}

/* ---------- 6. 影响因素联动 ---------- */
const DIM_LABEL = {
    medu: v => ["无", "小学", "初中", "高中", "高等教育"][v] || v,
    fedu: v => ["无", "小学", "初中", "高中", "高等教育"][v] || v,
    studytime: v => ["<2h", "2-5h", "5-10h", ">10h"][v - 1] || v,
    romantic: v => (v == 1 ? "恋爱中" : "未恋爱"),
    higher: v => (v == 1 ? "想升学" : "不想升学"),
    address: v => (v === "U" ? "城市" : "农村"),
    dalc: v => "等级" + v,
    walc: v => "等级" + v,
    goout: v => "等级" + v,
    freetime: v => "等级" + v,
    health: v => "等级" + v,
    failures: v => v + "次",
    school: v => v,
    famsize: v => (v === "LE3" ? "≤3人" : ">3人")
};

function renderDim(data, by) {
    const fmt = DIM_LABEL[by] || (v => v);
    const rawLabels = [...new Set(data.map(d => d.label))];
    rawLabels.sort((a, b) => String(a).localeCompare(String(b), "zh", { numeric: true }));
    const labels = rawLabels.map(fmt);

    reg("chartDim").setOption({
        tooltip: { ...TOOLTIP, trigger: "axis" },
        legend: { top: 0, textStyle: { color: T, fontSize: 10.5 }, itemWidth: 10, itemHeight: 7, itemGap: 10 },
        grid: { left: 36, right: 12, top: 30, bottom: 24 },
        xAxis: {
            type: "category", data: labels, axisLabel: { ...AXIS, interval: 0, rotate: labels.length > 6 ? 30 : 0 },
            axisLine: { lineStyle: { color: "rgba(90,130,220,.35)" } }
        },
        yAxis: { type: "value", max: 20, name: "均分", nameTextStyle: { color: T, fontSize: 11 }, axisLabel: AXIS, splitLine: SPLIT },
        series: COURSES.map(c => ({
            name: CN[c], type: "line", smooth: true, symbol: "circle", symbolSize: 6,
            lineStyle: { width: 2.4, color: COLORS[c] },
            itemStyle: { color: COLORS[c] },
            areaStyle: {
                opacity: .18,
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: COLORS[c] }, { offset: 1, color: "transparent" }
                ])
            },
            data: rawLabels.map(l => {
                const row = data.find(d => String(d.label) === String(l) && d.course === c);
                return row ? row.avgG3 : null;
            })
        }))
    }, true);
}

/* ---------- 7. 热力图 ---------- */
function renderHeat(points) {
    const xLabels = ["<2h", "2-5h", "5-10h", ">10h"];
    const yLabels = ["很低", "低", "中", "高", "很高"];
    const data = points.map(p => [p.x - 1, p.y - 1, p.value]);
    reg("chartHeat").setOption({
        tooltip: {
            ...TOOLTIP,
            formatter: p => `学习时间 ${xLabels[p.value[0]]}, 外出 ${yLabels[p.value[1]]}<br/>期末均分 ${p.value[2]}`
        },
        grid: { left: 40, right: 16, top: 14, bottom: 40 },
        xAxis: { type: "category", data: xLabels, name: "学习时间", nameTextStyle: { color: T, fontSize: 11 }, splitArea: { show: true, areaStyle: { color: ["rgba(20,32,70,.35)", "transparent"] } }, axisLabel: AXIS, axisLine: { lineStyle: { color: "rgba(90,130,220,.35)" } } },
        yAxis: { type: "category", data: yLabels, name: "外出频率", nameTextStyle: { color: T, fontSize: 11 }, splitArea: { show: true, areaStyle: { color: ["rgba(20,32,70,.35)", "transparent"] } }, axisLabel: AXIS, axisLine: { lineStyle: { color: "rgba(90,130,220,.35)" } } },
        visualMap: {
            min: 8, max: 17, calculable: true, orient: "horizontal", left: "center", bottom: 4,
            itemWidth: 12, itemHeight: 90,
            textStyle: { color: T, fontSize: 11 },
            inRange: { color: ["#12305e", "#1f6fa8", "#22b3a0", "#f2c14e", "#ff7a45"] }
        },
        series: [{
            type: "heatmap", data,
            label: { show: true, color: "#eaf3ff", fontSize: 11, formatter: p => p.value[2] },
            itemStyle: { borderColor: "rgba(6,11,31,.9)", borderWidth: 1 },
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(120,190,255,.7)" } }
        }]
    });
}

/* ---------- 8. 缺勤影响 ---------- */
function renderAbsence(data) {
    const bands = ["0次", "1-5次", "6-10次", "11-20次", "20次以上"];
    // 两科合并的均分与及格率更直观
    const avg = bands.map(b => {
        const rows = data.filter(d => d.label === b);
        const cnt = rows.reduce((s, r) => s + r.cnt, 0);
        if (!cnt) return null;
        return +(rows.reduce((s, r) => s + r.avgG3 * r.cnt, 0) / cnt).toFixed(2);
    });
    const pass = bands.map(b => {
        const rows = data.filter(d => d.label === b);
        const cnt = rows.reduce((s, r) => s + r.cnt, 0);
        if (!cnt) return null;
        return +(rows.reduce((s, r) => s + r.passRate * r.cnt, 0) / cnt).toFixed(3);
    });
    reg("chartAbsence").setOption({
        tooltip: { ...TOOLTIP, trigger: "axis" },
        legend: { top: 0, textStyle: { color: T, fontSize: 10.5 }, itemWidth: 10, itemHeight: 7, itemGap: 10 },
        grid: { left: 34, right: 38, top: 30, bottom: 22 },
        xAxis: { type: "category", data: bands, axisLabel: { ...AXIS, interval: 0, rotate: 24 }, axisLine: { lineStyle: { color: "rgba(90,130,220,.35)" } } },
        yAxis: [
            { type: "value", max: 20, name: "均分", nameTextStyle: { color: T, fontSize: 11 }, axisLabel: AXIS, splitLine: SPLIT },
            { type: "value", max: 1, name: "及格率", nameTextStyle: { color: T, fontSize: 11 }, axisLabel: { ...AXIS, formatter: v => (v * 100) + "%" }, splitLine: { show: false } }
        ],
        series: [
            {
                name: "平均成绩", type: "bar", barWidth: 26, data: avg,
                itemStyle: {
                    borderRadius: [3, 3, 0, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: "#7fb8ff" }, { offset: 1, color: "rgba(77,155,255,.16)" }
                    ])
                }
            },
            {
                name: "及格率", type: "line", yAxisIndex: 1, smooth: true, symbolSize: 6,
                lineStyle: { width: 2, color: "#ffb05c" }, itemStyle: { color: "#ffb05c" }, data: pass
            }
        ]
    });
}

/* ---------- 9. 散点 ---------- */
function renderScatter(records) {
    const mathPts = [], porPts = [];
    records.forEach(r => {
        if (r.isWithdrawn === 1) return;
        (r.course === "math" ? mathPts : porPts).push([r.g2, r.g3]);
    });
    reg("chartScatter").setOption({
        tooltip: { ...TOOLTIP, formatter: p => `${p.seriesName}<br/>G2 = ${p.value[0]}, G3 = ${p.value[1]}` },
        legend: { top: 4, textStyle: { color: T, fontSize: 11 }, itemWidth: 10, itemHeight: 8 },
        grid: { left: 38, right: 14, top: 24, bottom: 32 },
        xAxis: { type: "value", name: "第二期 G2", nameTextStyle: { color: T, fontSize: 11 }, min: 0, max: 20, axisLabel: AXIS, splitLine: SPLIT },
        yAxis: { type: "value", name: "期末 G3", nameTextStyle: { color: T, fontSize: 11 }, min: 0, max: 20, axisLabel: AXIS, splitLine: SPLIT },
        series: [
            { name: "数学", type: "scatter", symbolSize: 5.5, data: mathPts, itemStyle: { color: COLORS.math, opacity: .55 } },
            { name: "葡语", type: "scatter", symbolSize: 5.5, data: porPts, itemStyle: { color: COLORS.por, opacity: .55 } }
        ]
    });
}

/* ---------- 维度下拉联动 ---------- */
async function loadDim(by) {
    renderDim(await api(`/api/stats/group?by=${by}`), by);
}

/* ---------- 启动 / 刷新 ----------
 * 数据增删改之后调用 loadDashboard() 即可让全部 KPI 和图表实时更新
 */
async function loadDashboard() {
    const status = document.getElementById("status");
    try {
        const [overview, grades, dist, absences, heat, sexData, page] = await Promise.all([
            api("/api/stats/overview"),
            api("/api/stats/grades"),
            api("/api/stats/distribution"),
            api("/api/stats/absences"),
            api("/api/stats/heatmap"),
            api("/api/stats/group?by=sex"),
            api("/api/students?page=1&size=5000")
        ]);

        // 双修人数: 按 person_key 聚合, 同一人两门课都有有效成绩
        const personCourses = {};
        page.records.forEach(r => {
            if (r.isWithdrawn === 1) return;
            (personCourses[r.personKey] = personCourses[r.personKey] || new Set()).add(r.course);
        });
        const bothCount = Object.values(personCourses).filter(s => s.size === 2).length;

        renderKpi(overview, grades, bothCount);
        renderAvg(overview);
        renderGrade(grades);
        renderPass(overview);
        renderDistribution(dist);
        renderSex(sexData);
        renderHeat(heat);
        renderAbsence(absences);
        renderScatter(page.records);
        await loadDim(document.getElementById("dimSelect").value);

        status.textContent = "数据已加载 · " + new Date().toLocaleTimeString("zh-CN");
        status.className = "ok";
        loadDashboard._tries = 0;      // 成功后清零重试计数
    } catch (e) {
        status.className = "err";
        console.error(e);
        // 后端没就绪时每 3 秒自动重连, 最多 10 次, 启动完成后图表自动填充
        loadDashboard._tries = (loadDashboard._tries || 0) + 1;
        if (loadDashboard._tries <= 10) {
            status.textContent = "后端未就绪, 3 秒后自动重连 (" + loadDashboard._tries + "/10)…";
            setTimeout(loadDashboard, 3000);
        } else {
            status.textContent = "加载失败: " + e.message + "（请确认后端 8080 已启动, 刷新页面重试）";
        }
    }
}

/* =====================================================================
 * 数据管理模块 —— 增 / 删 / 改 / 查
 * 列表弹窗: 分页 + 条件查询 + 删除;  表单弹窗: 新增 / 编辑
 * ===================================================================== */

// 写操作统一走这里: fetch + JSON 请求体, 结果 {code,msg,data} 校验
async function apiSend(path, method, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const res = await fetch(API_BASE + path, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
            signal: ctrl.signal
        });
        const json = await res.json();
        if (json.code !== 200) throw new Error(json.msg || "操作失败");
        return json.data;
    } finally {
        clearTimeout(timer);
    }
}

const mgrState = { page: 1, size: 12, total: 0, editingId: null };

const MGR = document.getElementById("mgrModal");
const FORM = document.getElementById("formModal");

function openModal(el) { el.classList.add("show"); }
function closeModal(el) { el.classList.remove("show"); }

/* ----- 列表弹窗 ----- */
async function loadMgrTable() {
    const tbody = document.getElementById("mgrTbody");
    const q = new URLSearchParams({
        page: mgrState.page, size: mgrState.size,
        course: document.getElementById("qCourse").value,
        sex: document.getElementById("qSex").value,
        grade: document.getElementById("qGrade").value,
        keyword: document.getElementById("qKeyword").value.trim()
    });
    try {
        const data = await api("/api/students?" + q.toString());
        mgrState.total = data.total;
        const rows = data.records;
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="12" class="empty-row">没有符合条件的记录</td></tr>`;
        } else {
            tbody.innerHTML = rows.map(r => `
                <tr>
                    <td>${r.id}</td>
                    <td>${CN[r.course] || r.course}</td>
                    <td>${r.school}</td>
                    <td>${r.sex === "F" ? "女" : "男"}</td>
                    <td>${r.age}</td>
                    <td>${r.g1}</td><td>${r.g2}</td>
                    <td style="color:#6fd2ff;font-weight:600">${r.g3}</td>
                    <td>${r.absences}</td>
                    <td><span class="tag" style="background:rgba(47,214,180,.15);color:#37d3a4">${r.grade}</span></td>
                    <td>${r.address === "U" ? "城市" : "农村"}</td>
                    <td>
                        <button class="act-btn" onclick="editRecord(${r.id})">编辑</button>
                        <button class="act-btn del" onclick="delRecord(${r.id})">删除</button>
                    </td>
                </tr>`).join("");
        }
        document.getElementById("mgrTotal").textContent = "共 " + data.total + " 条";
        const pages = Math.max(1, Math.ceil(data.total / mgrState.size));
        document.getElementById("pgInfo").textContent = mgrState.page + " / " + pages;
        document.getElementById("pgPrev").disabled = mgrState.page <= 1;
        document.getElementById("pgNext").disabled = mgrState.page >= pages;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="12" class="empty-row">加载失败: ${e.message}</td></tr>`;
    }
}

// 编辑: 拉取详情填进表单
window.editRecord = async function (id) {
    try {
        const r = await api("/api/students/" + id);
        mgrState.editingId = id;
        document.getElementById("formTitle").textContent = "编辑成绩记录 (ID: " + id + ")";
        fillForm(r);
        openModal(FORM);
    } catch (e) { alert("获取详情失败: " + e.message); }
};

// 删除: 二次确认 -> 删除 -> 刷新表格与图表
window.delRecord = async function (id) {
    if (!confirm("确定删除这条成绩记录吗? (ID: " + id + ") 删除后不可恢复")) return;
    try {
        await apiSend("/api/students/" + id, "DELETE");
        await loadMgrTable();
        await loadDashboard();          // 大屏实时更新
        alert("删除成功");
    } catch (e) { alert("删除失败: " + e.message); }
};

/* ----- 表单弹窗 ----- */
const F_IDS = ["fCourse","fSchool","fSex","fAge","fAddress","fFamsize","fGuardian","fMedu","fFedu",
    "fMjob","fFjob","fStudytime","fTraveltime","fFailures","fGoout","fDalc","fWalc","fFreetime",
    "fHealth","fRomantic","fHigher","fG1","fG2","fG3","fAbsences"];

// 编辑时把详情写入表单
function fillForm(r) {
    const map = {
        fCourse: "course", fSchool: "school", fSex: "sex", fAge: "age", fAddress: "address",
        fFamsize: "famsize", fGuardian: "guardian", fMedu: "medu", fFedu: "fedu",
        fMjob: "mjob", fFjob: "fjob", fStudytime: "studytime", fTraveltime: "traveltime",
        fFailures: "failures", fGoout: "goout", fDalc: "dalc", fWalc: "walc",
        fFreetime: "freetime", fHealth: "health", fRomantic: "romantic", fHigher: "higher",
        fG1: "g1", fG2: "g2", fG3: "g3", fAbsences: "absences"
    };
    F_IDS.forEach(id => {
        const v = r[map[id]];
        document.getElementById(id).value = v === null || v === undefined ? "" : v;
    });
}

// 新增时给表单填一组默认值
function resetForm() {
    const defaults = {
        fCourse: "math", fSchool: "GP", fSex: "F", fAge: 17, fAddress: "U", fFamsize: "LE3",
        fGuardian: "mother", fMedu: 2, fFedu: 2, fMjob: "other", fFjob: "other",
        fStudytime: 3, fTraveltime: 3, fFailures: 0, fGoout: 3, fDalc: 1, fWalc: 1,
        fFreetime: 3, fHealth: 3, fRomantic: 0, fHigher: 1, fG1: 10, fG2: 10, fG3: 12, fAbsences: 2
    };
    F_IDS.forEach(id => document.getElementById(id).value = defaults[id]);
}

// 读取表单 -> JSON 对象
function readForm() {
    const o = {};
    F_IDS.forEach(id => {
        const el = document.getElementById(id);
        const key = id.slice(1).replace(/^./, ch => ch.toLowerCase()); // fG1 -> g1
        o[key] = el.tagName === "SELECT" ? el.value : el.value === "" ? null : +el.value;
    });
    // select 的值转数字(除职业/学校等字符串枚举)
    ["age","medu","fedu","studytime","traveltime","failures","goout","dalc","walc",
     "freetime","health","romantic","higher","g1","g2","g3","absences"]
        .forEach(k => o[k] = o[k] === null ? null : +o[k]);
    return o;
}

document.getElementById("formSave").addEventListener("click", async () => {
    const body = readForm();
    try {
        if (mgrState.editingId) {
            await apiSend("/api/students/" + mgrState.editingId, "PUT", body);
            alert("修改成功");
        } else {
            await apiSend("/api/students", "POST", body);
            alert("新增成功");
        }
        closeModal(FORM);
        mgrState.editingId = null;
        await loadMgrTable();
        await loadDashboard();          // 大屏实时更新
    } catch (e) { alert("保存失败: " + e.message); }
});

/* ----- 弹窗事件绑定(只绑一次) ----- */
document.getElementById("mgrBtn").addEventListener("click", () => {
    mgrState.page = 1;
    openModal(MGR);
    loadMgrTable();
});
document.getElementById("mgrClose").addEventListener("click", () => closeModal(MGR));
document.getElementById("formClose").addEventListener("click", () => { closeModal(FORM); mgrState.editingId = null; });
document.getElementById("qSearch").addEventListener("click", () => { mgrState.page = 1; loadMgrTable(); });
document.getElementById("qKeyword").addEventListener("keydown", e => {
    if (e.key === "Enter") { mgrState.page = 1; loadMgrTable(); }
});
document.getElementById("qReset").addEventListener("click", () => {
    document.getElementById("qKeyword").value = "";
    document.getElementById("qCourse").value = "";
    document.getElementById("qSex").value = "";
    document.getElementById("qGrade").value = "";
    mgrState.page = 1;
    loadMgrTable();
});
document.getElementById("qAdd").addEventListener("click", () => {
    mgrState.editingId = null;
    document.getElementById("formTitle").textContent = "新增成绩记录";
    resetForm();
    openModal(FORM);
});
document.getElementById("pgPrev").addEventListener("click", () => { if (mgrState.page > 1) { mgrState.page--; loadMgrTable(); } });
document.getElementById("pgNext").addEventListener("click", () => { mgrState.page++; loadMgrTable(); });

// 点击遮罩空白处关闭
MGR.addEventListener("click", e => { if (e.target === MGR) closeModal(MGR); });
FORM.addEventListener("click", e => { if (e.target === FORM) { closeModal(FORM); mgrState.editingId = null; } });

// 维度下拉联动只注册一次
document.getElementById("dimSelect").addEventListener("change", e => loadDim(e.target.value));

main();
