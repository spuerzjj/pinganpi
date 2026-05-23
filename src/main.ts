import Varlet from "@varlet/ui";
import "@varlet/ui/es/style";
import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

createApp(App).use(Varlet).mount("#app");
