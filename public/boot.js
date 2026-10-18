const input = document.getElementById("boot-input");
const state = document.getElementById("boot-state");
input.addEventListener("compositionstart", () => {
  input.dataset.composing = "true";
});
input.addEventListener("compositionend", () => {
  delete input.dataset.composing;
});
try {
  input.value = localStorage.getItem("fliq.quick-capture") || "";
} catch {
  state.textContent = "下書き未保存";
}
input.addEventListener("input", () => {
  try {
    localStorage.setItem("fliq.quick-capture", input.value);
    state.textContent = "下書き保存済み";
  } catch {
    state.textContent = "未保存・内容をコピーしてください";
  }
});
