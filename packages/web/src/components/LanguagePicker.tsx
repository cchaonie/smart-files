import { useI18n } from '@smart-files/shared/src/i18n';
import { BottomSheet } from './BottomSheet';
import { CheckCircleIcon } from './icons';
import type { Lang } from '@smart-files/shared/src/i18n/types';

const languages: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文' },
];

export function LanguagePicker({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang, setLang } = useI18n();

  function selectLanguage(code: Lang) {
    setLang(code);
    onClose();
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Language">
      <div className="flex flex-col">
        {languages.map(({ code, label }) => (
          <button
            key={code}
            onClick={() => selectLanguage(code)}
            className="flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg"
          >
            <span className="text-sm text-zinc-900 dark:text-zinc-100">{label}</span>
            {lang === code && <CheckCircleIcon className="w-5 h-5 text-blue-500" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
