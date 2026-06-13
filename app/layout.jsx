import { Toaster } from '@/components/ui/sonner';
import './globals.css';
import AnalyticsGate from './components/AnalyticsGate';
import KeepScreenAwake from './components/KeepScreenAwake';
import PwaRegister from './components/PwaRegister';
import ThemeColorSync from './components/ThemeColorSync';
import { QueryClientProviderWrapper } from './providers/query-client-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import packageJson from '../package.json';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
const publicBasePath = process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}` : '';
const deploySha = process.env.NEXT_PUBLIC_DEPLOY_SHA || '';

const darkReaderHydrationGuardScript = `
(function(){
  var DARK_READER_ATTR_PREFIX = 'data-darkreader-';
  var DARK_READER_STYLE_PREFIX = '--darkreader-';
  var stopTimer = null;

  function cleanElement(el) {
    if (!el || el.nodeType !== 1) return;

    for (var i = el.attributes.length - 1; i >= 0; i -= 1) {
      var attrName = el.attributes[i].name;
      if (attrName.indexOf(DARK_READER_ATTR_PREFIX) === 0) {
        el.removeAttribute(attrName);
      }
    }

    if (el.style && el.style.length) {
      for (var j = el.style.length - 1; j >= 0; j -= 1) {
        var propName = el.style[j];
        if (propName.indexOf(DARK_READER_STYLE_PREFIX) === 0) {
          el.style.removeProperty(propName);
        }
      }
    }
  }

  function cleanTree(root) {
    cleanElement(root);
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('[data-darkreader-inline-bg],[data-darkreader-inline-bgcolor],[data-darkreader-inline-bgimage],[data-darkreader-inline-border],[data-darkreader-inline-color],[data-darkreader-inline-fill],[data-darkreader-inline-stroke],[style*="--darkreader-"]');
    for (var i = 0; i < nodes.length; i += 1) cleanElement(nodes[i]);
  }

  try {
    cleanTree(document.documentElement);

    var observer = new MutationObserver(function(mutations){
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        if (mutation.type === 'attributes') {
          cleanElement(mutation.target);
          continue;
        }
        for (var j = 0; j < mutation.addedNodes.length; j += 1) {
          cleanTree(mutation.addedNodes[j]);
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true
    });

    stopTimer = window.setTimeout(function(){
      observer.disconnect();
      cleanTree(document.documentElement);
    }, 3000);

    window.addEventListener('load', function(){
      window.setTimeout(function(){
        if (stopTimer) window.clearTimeout(stopTimer);
        observer.disconnect();
        cleanTree(document.documentElement);
      }, 0);
    }, { once: true });
  } catch (e) {}
})();
`;

export const metadata = {
  title: `基估宝 · 投资组合 V${packageJson.version}`,
  description: '基金实时估值与个人投资组合管理工具'
};

export default function RootLayout({ children }) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="基估宝" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href={`${publicBasePath}/Icon-60@3x.png?v=${packageJson.version}`} />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href={`${publicBasePath}/Icon-60@3x.png?v=${packageJson.version}`}
        />
        <link rel="manifest" href={`${publicBasePath}/manifest.webmanifest?v=${packageJson.version}`} />
        {/* 初始为暗色；ThemeColorSync 会按 data-theme 同步为亮/暗 */}
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* 尽早设置 data-theme，减少首屏主题闪烁；与 suppressHydrationWarning 配合避免服务端/客户端 html 属性不一致报错 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: darkReaderHydrationGuardScript
          }}
        />
      </head>
      <body>
        <ThemeColorSync />
        <KeepScreenAwake />
        <PwaRegister basePath={publicBasePath} deploySha={deploySha} />
        <AnalyticsGate GA_ID={GA_ID} />
        <QueryClientProviderWrapper>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryClientProviderWrapper>
        <Toaster />
      </body>
    </html>
  );
}
