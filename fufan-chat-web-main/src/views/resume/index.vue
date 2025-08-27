<template>
    <div
        class="resume-analysis-container"
        v-loading="loading"
        element-loading-text="正在玩命解析中，请稍候..."
        element-loading-background="rgba(0, 0, 0, 0.7)"
    >
        <div class="container">
            <div>
                <h1 class="title">智能体·HR</h1>
            </div>

            <div class="action-bar">
                <div class="upload-btn">
                    <el-button type="primary" @click="triggerFileUpload" :disabled="loading">上传简历</el-button>
                    <input
                        ref="fileInput"
                        type="file"
                        multiple
                        accept=".pdf"
                        @change="handleFileChange"
                        style="display: none"
                    />
                </div>
                <div class="download-btn">
                    <el-button type="success" :disabled="!downloadUrl" @click="downloadResume"> 下载简历 </el-button>
                </div>
            </div>

            <!-- 表格 -->
            <el-table :data="tableData" border stripe class="resume-table" v-loading="loading">
                <el-table-column
                    v-for="column in tableColumns"
                    :key="column"
                    :prop="getColumnProp(column)"
                    :label="column"
                    :width="getColumnWidth(column)"
                >
                    <template #default="scope">
                        <div v-if="isProgressColumn(scope.row[getColumnProp(column)])">
                            <p>{{ scope.row[getColumnProp(column)] }}</p>
                            <div class="progress">
                                <div
                                    class="progress-bar"
                                    :style="{ width: getProgressWidth(scope.row[getColumnProp(column)]) + '%' }"
                                />
                            </div>
                        </div>
                        <span v-else>{{ scope.row[getColumnProp(column)] }}</span>
                    </template>
                </el-table-column>
            </el-table>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";

// 响应式数据
const fileInput = ref<HTMLInputElement>();
const loading = ref(false);
const downloadUrl = ref("");
const tableColumns = ref<string[]>([]);
const tableData = ref<any[]>([]);
let progressTimer: ReturnType<typeof setInterval> | null = null;

// 进度映射
const PROGRESS = new Map([
    ["待处理", 0],
    ["简历信息抽取", 20],
    ["简历打分", 50],
    ["简历画像", 50],
    ["薪资预测", 80],
    ["完成", 100]
]);

// 触发文件上传
const triggerFileUpload = () => {
    fileInput.value?.click();
};

// 处理文件选择
const handleFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;

    if (files && files.length > 0) {
        const params = {
            query: Array.from(files)
                .map((file) => file.name)
                .join(",")
        };

        // 发送上传请求
        uploadResume(params);
    }
};

// 上传简历
const uploadResume = async (params: { query: string }) => {
    // 开始新任务前，重置UI状态
    tableData.value = [];
    tableColumns.value = [];
    downloadUrl.value = "";
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }

    try {
        loading.value = true;
        const response = await fetch("/resume/extract-analysis", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(params)
        });

        if (response.ok) {
            ElMessage.success("文件上传成功，后台开始解析...");
            // 开始查询进度
            startProgressQuery();
        } else {
            ElMessage.error("文件上传失败");
            loading.value = false; // 仅在失败时关闭加载
        }
    } catch (error) {
        console.error("Upload error:", error);
        ElMessage.error("文件上传失败");
        loading.value = false; // 仅在异常时关闭加载
    }
};

// 开始查询进度
const startProgressQuery = () => {
    if (progressTimer) {
        clearInterval(progressTimer);
    }
    progressTimer = setInterval(queryProgress, 3000);
};

// 查询进度
const queryProgress = async () => {
    try {
        const response = await fetch("/resume/query-progress", {
            method: "GET"
        });

        if (response.ok) {
            const data = await response.json();

            if (data.data) {
                setTableData(data.data.columns, data.data.data);
                downloadUrl.value = data.data.data_path;

                // 检查是否全部完成
                const isFinish = data.data.data.every((item: any) => item[2] === "完成");
                if (isFinish && progressTimer) {
                    clearInterval(progressTimer);
                    progressTimer = null;
                    loading.value = false; // 在这里关闭加载
                    ElMessage.success("所有简历处理完成");
                }
            } else {
                // 如果查询失败，也停止加载和轮询
                if (progressTimer) {
                    clearInterval(progressTimer);
                    progressTimer = null;
                }
                loading.value = false;
            }
        }
    } catch (error) {
        console.error("Query progress error:", error);
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
        loading.value = false;
    }
};

// 设置表格数据
const setTableData = (columns: string[], data: any[]) => {
    tableColumns.value = columns;
    tableData.value = data.map((row, _index) => {
        const rowData: any = {};
        columns.forEach((column, colIndex) => {
            rowData[`col${colIndex}`] = row[colIndex];
        });
        return rowData;
    });
};

// 获取列属性名
const getColumnProp = (column: string) => {
    const index = tableColumns.value.indexOf(column);
    return `col${index}`;
};

// 获取列宽度
const getColumnWidth = (column: string) => {
    if (column === "简历处理状态") return 150;
    if (column === "简历文件名") return 200;
    if (column === "毕业学校" || column === "专业") return 150;
    return 120;
};

// 判断是否为进度列
const isProgressColumn = (value: string) => {
    return PROGRESS.has(value);
};

// 获取进度宽度
const getProgressWidth = (status: string) => {
    return PROGRESS.get(status) || 0;
};

// 下载简历
const downloadResume = () => {
    if (downloadUrl.value) {
        const link = document.createElement("a");
        link.href = downloadUrl.value;
        link.download = "简历分析结果.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

/*
// 初始化mock数据
const initMockData = () => {
    const mockThead = [
        "简历编号",
        "简历文件名",
        "简历处理状态",
        "姓名",
        "年龄",
        "性别",
        "毕业学校",
        "专业",
        "技能平台",
        "工作年限",
        "简历画像",
        "薪资预测"
    ];

    const mockBody = [
        ["1", "xx_简历.pdf", "简历信息抽取", "王二", "30", "男", "xx大学", "xx专业", "前端开发", "6年", "80", "15000"],
        ["2", "xx_简历.pdf", "简历信息抽取", "王二", "30", "男", "xx大学", "xx专业", "前端开发", "6年", "80", "15000"],
        [
            "3",
            "zz_简历.pdf",
            "简历信息抽取",
            "张三",
            "20",
            "男",
            "清华大学",
            "xx专业",
            "前端开发",
            "6年",
            "80",
            "15000"
        ],
        ["4", "zz_简历.pdf", "待处理", "张三", "20", "男", "清华大学", "xx专业", "前端开发", "6年", "80", "15000"],
        ["5", "xx_简历.pdf", "完成", "王二", "30", "男", "xx大学", "xx专业", "前端开发", "6年", "80", "15000"]
    ];

    setTableData(mockThead, mockBody);
};
*/

// 生命周期
onMounted(() => {
    // 页面加载时，查询一次进度，以便恢复任何正在进行的任务的状态
    queryProgress();
});

onUnmounted(() => {
    if (progressTimer) {
        clearInterval(progressTimer);
    }
});
</script>

<style scoped>
.resume-analysis-container {
    background: #0368ca;
    color: #fff;
    min-height: 100vh;
    padding: 24px;
}

.container {
    width: 100%;
    margin: 0 auto;
}

.title {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 16px 0;
    text-align: center;
}

.action-bar {
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.upload-btn {
    position: relative;
}

.download-btn {
    flex: 1;
    text-align: right;
}

.resume-table {
    margin: 16px 0;
    width: 100%;
    background: #fff;
    color: #333;
    font-size: 14px;
}

.resume-table :deep(.el-table__header) {
    background-color: #014e98;
}

.resume-table :deep(.el-table__header th) {
    background-color: #014e98;
    color: #fff;
    border: 1px solid #005ab1;
}

.resume-table :deep(.el-table__body td) {
    border: 1px solid #005ab1;
    height: 50px;
    box-sizing: border-box;
}

.progress {
    width: 100%;
    height: 10px;
    background: #ccc;
    border-radius: 5px;
    position: relative;
    margin-top: 5px;
}

.progress-bar {
    width: 0%;
    height: 100%;
    background: #03ac63;
    border-radius: 5px;
    overflow: hidden;
    clip-path: inset(0 0 0 0);
    position: relative;
}

.progress-bar::after {
    content: "";
    position: absolute;
    width: 100%;
    height: 100%;
    background: linear-gradient(to right, #dfb015, #03ac63);
    border-radius: 5px;
    z-index: 100;
}

p {
    margin: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .resume-analysis-container {
        padding: 16px;
    }

    .action-bar {
        flex-direction: column;
        gap: 10px;
    }

    .download-btn {
        text-align: center;
    }
}
</style>
