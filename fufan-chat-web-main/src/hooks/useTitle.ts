import { ref, watch } from "vue";

/** 项目标题 */
const VITE_APP_TITLE = import.meta.env.VITE_APP_TITLE ?? "智能体";

/** 设置 document.title */
export const useTitle = () => {
    const title = ref(VITE_APP_TITLE);
    watch(
        title,
        (value, oldValue) => {
            if (document && value !== oldValue) {
                document.title = value;
            }
        },
        { immediate: true }
    );

    const setTitle = (value?: string) => {
        title.value = value ? `${VITE_APP_TITLE} | ${value}` : VITE_APP_TITLE;
    };

    return { setTitle };
};
