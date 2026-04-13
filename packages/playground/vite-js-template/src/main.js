import "./style.css";
import { h } from "vue";
import { cloneDeep } from "lodash-es";
import javascriptLogo from "./javascript.svg";
import viteLogo from "./vite.svg";
import { setupCounter } from "./counter";
import SUBARU from "./assets/486.png";

console.log(javascriptLogo, viteLogo, SUBARU);
document.querySelector("#app").innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
      <img src="${SUBARU}" class="logo vanilla" alt="JavaScript logo" />
    </a>
    <h1>Hello Vite!</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite logo to learn more
    </p>
  </div>
`;
console.log(h);
console.log(cloneDeep({ a: 1, b: 2 }));

setupCounter(document.querySelector("#counter"));
