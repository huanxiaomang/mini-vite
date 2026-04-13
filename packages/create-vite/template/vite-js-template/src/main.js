import "./style.css";
import { h } from "vue";
import { cloneDeep } from "lodash-es";
import javascriptLogo from "./javascript.svg";
import liteViteLogo from "./vite.svg";
import { setupCounter } from "./counter";
import SUBARU from "./assets/486.png";

console.log(javascriptLogo, liteViteLogo, SUBARU);
document.querySelector("#app").innerHTML = `
  <div>
    <a href="https://github.com/user/lite-vite" target="_blank">
      <img src="${liteViteLogo}" class="logo" alt="Lite Vite logo" />
    </a>
    <a href="" target="_blank">
      <img src="${SUBARU}" class="logo vanilla" alt="JavaScript logo" />
    </a>
    <h1>Hello Lite Vite!</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      由 Lite Vite 驱动的 Vanilla JS 项目
    </p>
  </div>
`;
console.log(h);
console.log(cloneDeep({ a: 1, b: 2 }));

setupCounter(document.querySelector("#counter"));
