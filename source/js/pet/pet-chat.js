/**
 * ============================================
 * 模块7: 角色聊天气泡 (pet-chat.js)
 * ============================================
 */
/**
 * ============================================
 * 模块7: 角色聊天气泡 (pet-chat.js)
 * ============================================
 */
import { State } from "./pet-sprite.js";

export class PetChat {
  constructor(bubbleEl, textEl, innerEl) {
    this.bubbleEl = bubbleEl;
    this.textEl = textEl;
    this.innerEl = innerEl;

    this.idleTime = 0;
    this.bubbleTimer = null;
    this.dragSayTimer = null; // 拖拽对话延迟定时器
    this.isSpeaking = false;
    this.lastState = State.IDLE;

    // 台词是"中文值 → pet.* 词条"的值通道配置:i18n.get(台词) 按字典翻译,
    // 因此这里必须与 language/zh.yml 的 pet.* 保持一字不差
    this.dialogues = {
      drag: ["放开我!!!", "救命啊!!!", "我讨厌你~呜呜"], // i18n:allow
      click: ["不要老是戳我呀", "真讨厌!", "你又点我了!"], // i18n:allow
      rightClick: ["不要右键点我听到没有", "干什么啊"], // i18n:allow
      fall: ["哼", "哎呀"], // i18n:allow
      idle: [
        "你怎么不理我了", // i18n:allow
        "快点和我说话", // i18n:allow
        "我好无聊啊", // i18n:allow
        "老师我想听歌", // i18n:allow
        "我好困啊", // i18n:allow
        "可以放首歌吗我想听歌!!!", // i18n:allow
        "不要右键戳我", // i18n:allow
      ],
    };

    this._bindEvents();
  }

  _bindEvents() {
    // 移除原生的 click 监听，防覆盖。左键点击对话全权由状态机触发！

    // 仅保留右键的监听
    this.innerEl.addEventListener("contextmenu", () => {
      this.idleTime = 0;
      this.say(this._random(this.dialogues.rightClick));
    });
  }

  update(dt, currentState) {
    if (this.lastState !== currentState) {
      // 1. 进入拖拽状态：延迟 200ms 触发拖拽对话（防止短按时气泡闪烁冲突）
      if (currentState === State.DRAGGING) {
        this.dragSayTimer = setTimeout(() => {
          this.say(this._random(this.dialogues.drag));
        }, 200);
      }

      // 2. 从拖拽状态离开：判定是点击还是松开
      if (this.lastState === State.DRAGGING) {
        clearTimeout(this.dragSayTimer); // 及时清理拖拽定时器

        if (currentState === State.FALL) {
          // 拖拽后松开 -> 触发掉落对话
          this.say(this._random(this.dialogues.fall));
        } else if (currentState === State.RUNNING) {
          // 短按点击后逃跑 -> 触发点击对话
          this.idleTime = 0;
          this.say(this._random(this.dialogues.click));
        }
      }

      this.lastState = currentState;
    }

    this.idleTime += dt;
    if (this.idleTime >= 60) {
      this.idleTime = 0;
      this.say(this._random(this.dialogues.idle));
    }
  }

  say(text, duration = 3000) {
    if (!this.bubbleEl || !this.textEl) return;

    // 显示前先按当前语言渲染:此前靠 lang-switch 的观察器事后翻译,
    // 气泡会先闪一下中文再变成译文,观感很差
    const translated =
      window.i18n && typeof window.i18n.get === "function"
        ? window.i18n.get(text)
        : text;
    this.textEl.textContent = translated;
    this.bubbleEl.style.display = "block";
    this.bubbleEl.style.opacity = "1";
    this.isSpeaking = true;

    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      this.bubbleEl.style.opacity = "0";
      setTimeout(() => {
        this.bubbleEl.style.display = "none";
        this.isSpeaking = false;
      }, 300);
    }, duration);
  }

  _random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
