import { createApp, h } from "vue";
import "./style.css";
import App from "./App.vue";
// const App = {
//   render() {
//     return h("div", {}, "213");
//   },
// };
export interface TEST {
  a: string;
  b: string;
}
console.error("error in line 13");

createApp(App).mount("#app");
