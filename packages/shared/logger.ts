import pc from "picocolors";

type LogLevel = "debug" | "info" | "warn" | "error";

// 定义格式化函数类型
export type Formatter = (input: string | number | null | undefined) => string;

// 定义颜色接口
export interface Colors {
  reset: Formatter;
  bold: Formatter;
  dim: Formatter;
  italic: Formatter;
  underline: Formatter;
  inverse: Formatter;
  hidden: Formatter;
  strikethrough: Formatter;

  black: Formatter;
  red: Formatter;
  green: Formatter;
  yellow: Formatter;
  blue: Formatter;
  magenta: Formatter;
  cyan: Formatter;
  white: Formatter;
  gray: Formatter;

  bgBlack: Formatter;
  bgRed: Formatter;
  bgGreen: Formatter;
  bgYellow: Formatter;
  bgBlue: Formatter;
  bgMagenta: Formatter;
  bgCyan: Formatter;
  bgWhite: Formatter;

  blackBright: Formatter;
  redBright: Formatter;
  greenBright: Formatter;
  yellowBright: Formatter;
  blueBright: Formatter;
  magentaBright: Formatter;
  cyanBright: Formatter;
  whiteBright: Formatter;

  bgBlackBright: Formatter;
  bgRedBright: Formatter;
  bgGreenBright: Formatter;
  bgYellowBright: Formatter;
  bgBlueBright: Formatter;
  bgMagentaBright: Formatter;
  bgCyanBright: Formatter;
  bgWhiteBright: Formatter;
}

// 日志等级权重
const levelWeights: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 日志等级颜色
const levelColors: Record<LogLevel, (str: string) => string> = {
  debug: pc.gray,
  info: pc.cyan,
  warn: pc.yellow,
  error: pc.red,
};

// 定义日志器接口
interface Logger extends Colors {
  (message: string, ...args: any[]): void;
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

/**
 * 创建日志打印器
 * @param minLevel 最低显示的日志等级
 */
function createLogger(minLevel: LogLevel = "info"): Logger {
  const shouldLog = (level: LogLevel) =>
    levelWeights[level] >= levelWeights[minLevel];

  // 核心日志方法
  const logger = Object.assign(
    (message: any, ...args: any[]) => {
      if (shouldLog("info")) {
        console.log(levelColors.info(`[INFO] ${message}`), ...args);
      }
    },
    {
      debug: (message: any, ...args: any[]) => {
        if (shouldLog("debug")) {
          console.log(levelColors.debug(`[DEBUG] ${message}`), ...args);
        }
      },
      info: (message: any, ...args: any[]) => {
        if (shouldLog("info")) {
          console.log(levelColors.info(`[INFO] ${message}`), ...args);
        }
      },
      warn: (message: any, ...args: any[]) => {
        if (shouldLog("warn")) {
          console.warn(levelColors.warn(`[WARN] ${message}`), ...args);
        }
      },
      error: (message: any, ...args: any[]) => {
        if (shouldLog("error")) {
          console.error(levelColors.error(`[ERROR] ${message}`), ...args);
        }
      },
    }
  );

  // 添加颜色方法
  Object.entries(pc).forEach(([color, fn]) => {
    (logger as any)[color] = fn;
  });

  return logger as Logger;
}

// 根据环境创建默认日志实例
const env = process.env.NODE_ENV || "development";
const defaultLevel = env === "production" ? "warn" : "debug";
export const log = createLogger(defaultLevel);
