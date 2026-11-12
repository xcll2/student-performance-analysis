/* ==========================================================================
   member-c.js —— 杨佳乐作品：课程标签式大屏
   顶部切换 数学课 / 葡萄牙语课 / 学生数据管理；30 秒自动刷新
   ========================================================================== */
(function () {
    "use strict";

    const charts = {};
    const S = { profile: null, all: [], course: "math" };
    const C = {
        blue: "#4a8fe8", blue2: "#2f6fd0", cyan: "#35c4d8", green: "#35c48e",
        orange: "#e8a33d", red: "#d9534f", gray: "#5d7799",
        txt: "#94aecd", txt3: "#5d7799", line: "rgba(72,132,210,0.28)"
    };
    const LV = { 1: "<2小时", 2: "2-5小时", 3: "5-10小时", 4: ">10小时" };
    let timer = null;

    /* ---------------- 工具 ---------------- */
    async function api(path, opt) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        try {
            const res = await fetch(path, Object.assign({ signal: ctrl.signal }, opt || {}));
            const json = await res.json();
            if (json.code !== 200) throw new Error(json.msg || "接口异常");
            return json.data;
        } finally {
            clearTimeout(t);
        }
    }

    function msg(text) {
        const el = document.getElementById("msg");
        el.textContent = text;
        el.classList.add("show");
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove("show"), 2200);
    }

    function mk(id) {
        if (!charts[id]) {
            const dom = document.getElementById(id);
            if (!dom) return null;
            charts[id] = echarts.init(dom);
        }
        return charts[id];
    }

    function ax(extra) {
        return Object.assign({
            axisLine: { lineStyle: { color: C.line } },
            axisTick: { show: false },
            axisLabel: { color: C.txt, fontSize: 10 },
            splitLine: { lineStyle: { color: "rgba(72,132,210,0.10)" } }
        }, extra || {});
    }

    const TIP = {
        backgroundColor: "rgba(8,18,38,0.95)",
        borderColor: "rgba(72,132,210,0.5)",
        textStyle: { color: "#dbeeff", fontSize: 11 },
        extraCssText: "border-radius:4px;box-shadow:0 6px 18px rgba(0,0,0,.5)"
    };

    function grad(a, b) {
        return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: a }, { offset: 1, color: b }]);
    }

    /* ---------------- KPI ---------------- */
    function renderKpi() {
        const k = S.profile.kpi;
        document.getElementById("k1").textContent = k.cnt;
        document.getElementById("k2").textContent = k.avgG3;
        document.getElementById("k3").textContent = k.passRate;
        document.getElementById("k4").textContent = k.avgStudy;
    }

    /* ---------------- 环形图：学习时长分布 ---------------- */
    function chartDonut() {
        const c = mk("c_donut"); if (!c) return;
        const rows = S.profile.studyDist.slice().sort((a, b) => a.level - b.level);
        const total = rows.reduce((s, r) => s + r.cnt, 0);
        const color = { 1: "#35c4d8", 2: "#35c48e", 3: "#e8a33d", 4: "#d9534f" };
        c.setOption({
            tooltip: Object.assign({ trigger: "item", formatter: "{b}：{c} 人（{d}%）" }, TIP),
            legend: {
                orient: "horizontal", left: "center", bottom: 4,
                itemWidth: 8, itemHeight: 8, itemGap: 10,
                textStyle: { color: C.txt, fontSize: 9.5 },
                formatter: (name) => {
                    const r = rows.find(x => LV[x.level] === name);
                    return name + "　" + (r ? r.cnt + "人" : "");
                }
            },
            title: {
                text: total + "\n总人数",
                left: "center", top: "40%", textAlign: "center",
                textStyle: { color: "#dbeafc", fontSize: 15, lineHeight: 19, fontWeight: 600 }
            },
            series: [{
                type: "pie",
                radius: ["50%", "72%"],
                center: ["50%", "47%"],
                avoidLabelOverlap: true,
                itemStyle: { borderColor: "#0a1730", borderWidth: 2 },
                label: { show: false },
                data: rows.map(r => ({
                    name: LV[r.level], value: r.cnt,
                    itemStyle: { color: color[r.level] || C.gray }
                }))
            }]
        });
    }

    /* ---------------- 分段分布 ---------------- */
    function chartSeg() {
        const c = mk("c_seg"); if (!c) return;
        const rows = S.profile.seg4;
        const color = ["#2f6fd0", "#4a8fe8", "#35c48e", "#35c4d8"];
        c.setOption({
            tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" }, formatter: (p) => `${p[0].name}<br/>${p[0].value} 人` }, TIP),
            grid: { left: 42, right: 14, top: 16, bottom: 24 },
            xAxis: ax({ type: "category", data: rows.map(r => r.label), axisLabel: { color: C.txt, fontSize: 9.5 } }),
            yAxis: ax({ type: "value", name: "人数", nameTextStyle: { color: C.txt, fontSize: 10 }, nameGap: 12 }),
            series: [{
                type: "bar", barWidth: "44%",
                itemStyle: {
                    borderRadius: [2, 2, 0, 0],
                    color: (p) => grad(color[p.dataIndex % 4], "rgba(20,60,120,0.55)")
                },
                label: { show: true, position: "top", color: "#a9c8ea", fontSize: 10 },
                data: rows.map(r => r.cnt)
            }]
        });
    }

    /* ---------------- 各时长组 平均分 + 及格率 ---------------- */
    function chartRate() {
        const c = mk("c_rate"); if (!c) return;
        const rows = S.profile.studyAvg.filter(r => r.course === S.course).sort((a, b) => a.level - b.level);
        c.setOption({
            tooltip: Object.assign({ trigger: "axis" }, TIP),
            legend: {
                data: ["平均分", "及格率"], right: 6, top: 0,
                itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt, fontSize: 9.5 }
            },
            grid: { left: 40, right: 40, top: 30, bottom: 22 },
            xAxis: ax({ type: "category", data: rows.map(r => LV[r.level]), axisLabel: { color: C.txt, fontSize: 9.5 } }),
            yAxis: [
                ax({ type: "value", max: 20, name: "平均分", nameTextStyle: { color: C.txt, fontSize: 9.5 }, nameGap: 10 }),
                ax({ type: "value", max: 100, splitLine: { show: false }, axisLabel: { color: C.txt, fontSize: 9.5, formatter: "{value}%" } })
            ],
            series: [
                {
                    name: "平均分", type: "bar", barWidth: "42%",
                    itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#4fd8b4", "#1c7a5e") },
                    label: { show: true, position: "top", color: "#8fe4c4", fontSize: 9.5 },
                    data: rows.map(r => r.avgG3)
                },
                {
                    name: "及格率", type: "line", yAxisIndex: 1, smooth: true, symbol: "circle", symbolSize: 6,
                    lineStyle: { width: 2, color: C.orange }, itemStyle: { color: C.orange },
                    data: rows.map(r => r.passRate)
                }
            ]
        });
    }

    /* ---------------- 散点：学习时长 vs 期末成绩 ---------------- */
    function chartScatter() {
        const c = mk("c_scatter"); if (!c) return;
        const rows = S.all.filter(r => r.course === S.course);
        // 抖动：同一档位的点横向散开，避免完全重叠成一条竖线
        const data = rows.map((r, i) => {
            const jitter = ((i % 11) - 5) / 5 * 0.34;
            return [r.studytime - 1 + jitter, r.g3];
        });
        c.setOption({
            tooltip: Object.assign({
                formatter: (p) => `学习时长 ${LV[Math.round(p.value[0]) + 1] || "—"}<br/>期末成绩 <b>${p.value[1]}</b> 分`
            }, TIP),
            grid: { left: 42, right: 16, top: 16, bottom: 38 },
            xAxis: ax({
                type: "value", min: -0.5, max: 3.5, interval: 1,
                name: "每周学习时长", nameLocation: "middle", nameGap: 24,
                nameTextStyle: { color: C.txt3, fontSize: 9.5 },
                axisLabel: { color: C.txt, fontSize: 9.5, formatter: (v) => LV[v + 1] || "" }
            }),
            yAxis: ax({ type: "value", min: 0, max: 20, splitNumber: 4 }),
            series: [{
                type: "scatter", symbolSize: 5.5, data: data,
                itemStyle: { color: "rgba(91,156,240,0.62)", borderColor: "rgba(120,180,250,0.5)", borderWidth: 0.4 },
                large: true,
                markLine: {
                    silent: true, symbol: "none",
                    lineStyle: { color: "rgba(232,163,61,0.75)", type: "dashed", width: 1 },
                    label: { formatter: "及格线 10 分", color: "#e8a33d", fontSize: 9, position: "insideStartTop" },
                    data: [{ yAxis: 10 }]
                }
            }]
        });
    }

    /* ---------------- 两课程平均分对比 ---------------- */
    function chartCmp() {
        const c = mk("c_cmp"); if (!c) return;
        const rows = S.profile.studyAvg;
        const levels = [1, 2, 3, 4];
        const pick = (course) => levels.map(lv => {
            const r = rows.find(x => x.level === lv && x.course === course);
            return r ? r.avgG3 : 0;
        });
        c.setOption({
            tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, TIP),
            legend: {
                data: ["数学课", "葡萄牙语课"], right: 6, top: 0,
                itemWidth: 8, itemHeight: 8, textStyle: { color: C.txt, fontSize: 9.5 }
            },
            grid: { left: 40, right: 14, top: 30, bottom: 22 },
            xAxis: ax({ type: "category", data: levels.map(l => LV[l]), axisLabel: { color: C.txt, fontSize: 9.5 } }),
            yAxis: ax({ type: "value", max: 20, name: "平均分", nameTextStyle: { color: C.txt, fontSize: 9.5 }, nameGap: 10 }),
            series: [
                {
                    name: "数学课", type: "bar", barWidth: "30%", barGap: "16%",
                    itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#5b9cf0", "#2a5da8") },
                    label: { show: true, position: "top", color: "#9fc6ea", fontSize: 8.5 },
                    data: pick("math")
                },
                {
                    name: "葡萄牙语课", type: "bar", barWidth: "30%",
                    itemStyle: { borderRadius: [2, 2, 0, 0], color: grad("#4fd8b4", "#1c7a5e") },
                    label: { show: true, position: "top", color: "#8fe4c4", fontSize: 8.5 },
                    data: pick("por")
                }
            ]
        });
    }

    /* ---------------- 数据管理 ---------------- */
    let mgrPage = 1;
    const MGR_SIZE = 50;
    let mgrRows = [];

    async function loadMgr(page) {
        mgrPage = page || 1;
        const q = document.getElementById("q").value.trim();
        const course = document.getElementById("fCourse").value;
        const grade = document.getElementById("fGrade").value;
        const qs = new URLSearchParams({ page: mgrPage, size: MGR_SIZE });
        if (q) qs.set("keyword", q);
        if (course) qs.set("course", course);
        if (grade) qs.set("grade", grade);
        const data = await api("/api/students?" + qs.toString());
        mgrRows = data.records;
        document.getElementById("mgrBody").innerHTML = mgrRows.map(r => `<tr>
            <td>${r.id}</td>
            <td>${r.course === "math" ? "数学" : "葡语"}</td>
            <td>${r.school}</td>
            <td>${r.sex}</td>
            <td>${r.age}</td>
            <td>${r.address === "U" ? "城市" : "农村"}</td>
            <td>${r.studytime}</td>
            <td>${r.failures}</td>
            <td>${r.absences}</td>
            <td>${r.g1}</td>
            <td>${r.g2}</td>
            <td>${r.g3}</td>
            <td><span class="tag ${r.grade}">${r.grade}</span></td>
            <td><button class="btn danger" data-del="${r.id}" style="padding:2px 8px;font-size:10px">删除</button></td>
        </tr>`).join("");
        const total = data.total;
        const pages = Math.max(1, Math.ceil(total / MGR_SIZE));
        document.getElementById("mgrCount").innerHTML =
            `共 ${total} 条 · 第 ${mgrPage} / ${pages} 页　` +
            `<button class="btn" id="prevPage" style="padding:2px 8px;font-size:10px" ${mgrPage <= 1 ? "disabled" : ""}>上一页</button> ` +
            `<button class="btn" id="nextPage" style="padding:2px 8px;font-size:10px" ${mgrPage >= pages ? "disabled" : ""}>下一页</button>`;
        const prev = document.getElementById("prevPage");
        const next = document.getElementById("nextPage");
        if (prev) prev.onclick = () => loadMgr(mgrPage - 1);
        if (next) next.onclick = () => loadMgr(mgrPage + 1);
    }

    async function del(id) {
        if (!confirm("确定删除 ID = " + id + " 的这条成绩记录吗？删除后大屏统计会同步变化。")) return;
        try {
            await api("/api/students/" + id, { method: "DELETE" });
            msg("已删除 ID " + id);
            await loadMgr(mgrPage);
            refresh(false);
        } catch (e) {
            msg("删除失败：" + e.message);
        }
    }

    /* ---------------- 渲染/切换 ---------------- */
    async function loadAll() {
        const [profile, all] = await Promise.all([
            api("/api/dash/profile?course=" + (S.course === "manage" ? "math" : S.course)),
            api("/api/dash/all")
        ]);
        S.profile = profile;
        S.all = all;
        document.getElementById("upd").textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    }

    function renderCharts() {
        renderKpi();
        chartDonut();
        chartSeg();
        chartRate();
        chartScatter();
        chartCmp();
        setTimeout(() => Object.values(charts).forEach(c => c.resize()), 20);
    }

    async function switchTab(tab) {
        document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
        const wrap = document.getElementById("wrap");
        if (tab === "manage") {
            wrap.classList.add("manage");
            await loadMgr(1);
            return;
        }
        wrap.classList.remove("manage");
        S.course = tab;
        try {
            await loadAll();
            renderCharts();
        } catch (e) {
            msg("加载失败：" + e.message);
        }
    }

    async function refresh(manual) {
        if (S.course === "manage") { return; }
        try {
            await loadAll();
            renderCharts();
            if (manual) msg("数据已刷新");
        } catch (e) {
            if (manual) msg("刷新失败：" + e.message);
        }
    }

    /* ---------------- 启动 ---------------- */
    async function main() {
        document.getElementById("tabs").addEventListener("click", e => {
            const t = e.target.closest(".tab");
            if (t) switchTab(t.dataset.tab);
        });
        document.getElementById("btnSearch").addEventListener("click", () => loadMgr(1));
        document.getElementById("q").addEventListener("keydown", e => { if (e.key === "Enter") loadMgr(1); });
        document.getElementById("fCourse").addEventListener("change", () => loadMgr(1));
        document.getElementById("fGrade").addEventListener("change", () => loadMgr(1));
        document.getElementById("btnReset").addEventListener("click", () => {
            document.getElementById("q").value = "";
            document.getElementById("fCourse").value = "";
            document.getElementById("fGrade").value = "";
            loadMgr(1);
        });
        document.getElementById("mgrBody").addEventListener("click", e => {
            const b = e.target.closest("[data-del]");
            if (b) del(b.dataset.del);
        });
        window.addEventListener("resize", () => Object.values(charts).forEach(c => c.resize()));

        const tabParam = new URLSearchParams(location.search).get("tab");
        try {
            await loadAll();
            renderCharts();
            if (tabParam) switchTab(tabParam);
        } catch (e) {
            msg("后端未就绪：" + e.message + "，3 秒后重试");
            let n = 0;
            const t = setInterval(async () => {
                n++;
                try { await loadAll(); renderCharts(); clearInterval(t); msg("数据已加载"); }
                catch (e2) { if (n >= 10) clearInterval(t); }
            }, 3000);
        }

        // 30 秒自动刷新（与学生数据管理页无关）
        timer = setInterval(() => refresh(false), 30000);
    }

    main();
})();
