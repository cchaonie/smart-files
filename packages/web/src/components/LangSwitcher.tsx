import { useI18n } from '@smart-files/shared/src/i18n';

export function LangSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'zh-CN' ? 'en' : 'zh-CN')}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      title={lang === 'zh-CN' ? 'Switch to English' : '切换到中文'}
    >
      {lang === 'zh-CN' ? 'EN' : '中'}
    </button>
  );
}
