export type Lang = 'zh-CN' | 'en';

export interface I18nStrings {
  appName: string; loading: string;
  homeTagline: string; signIn: string; register: string;
  signInTitle: string; signInSubtitle: string; email: string; password: string;
  signingIn: string; noAccount: string; registerLink: string;
  createAccount: string; registerSubtitle: string; nameOptional: string;
  passwordMinLength: string; creating: string; hasAccount: string;
  signInLink: string; registrationFailed: string;
  yourFiles: string; filesSubtitle: string; trash: string; backToFiles: string;
  signOut: string; root: string; searchPlaceholder: string; trashTitle: string;
  emptyTrash: string; trashEmpty: string; trashLoading: string; loadingElipsis: string;
  noSubfolders: string; selectedCount: string; deleteSelected: string; restore: string;
  deletePermanently: string; deselect: string; batchDeleteFailed: string;
  batchRestoreFailed: string; batchPurgeFailed: string;
  colName: string; colFolder: string; colSize: string; colDeleted: string; colActions: string;
  delete: string; deleteFile: string; deleteConfirm: string; deleteSelectedConfirm: string;
  deleteFailed: string; confirmDeleteTitle: string; confirmDeleteMessage: string;
  restoreFailed: string; moveFile: string; moveFileTitle: string; into: string;
  moveHere: string; moveFailed: string; cancel: string; close: string;
  rename: string; renameFile: string; renameFolder: string; renameFailed: string;
  newFolder: string; newFolderName: string; folderName: string; create: string;
  createFolderFailed: string; deleteFolderConfirm: string; download: string;
  share: string; shareFile: string; shareFileTitle: string;
  passwordProtection: string; passwordOptional: string; noPassword: string;
  expiresIn: string; never: string; oneHour: string; twentyFourHours: string;
  sevenDays: string; thirtyDays: string; createLink: string; creatingLink: string;
  shareFailed: string; shareLinkCreated: string; shareLinkLabel: string;
  copyLink: string; done: string;
  linkUnavailable: string; passwordProtected: string; enterPassword: string;
  verify: string; verifying: string; downloadFile: string;
  preview: string; previewUnavailable: string; playVideo: string; playAudio: string;
  video: string; audio: string; file: string; play: string; openFile: string;
  unsupportedVideo: string; unsupportedAudio: string;
  upload: string; uploading: string; pending: string; error: string; retry: string;
  aborted: string; uploadFailed: string; sessionFailed: string; parallelUploads: string; parallelUploadsDesc: string;
  configureServer: string; tapToConfigure: string; serverLabel: string;
  cannotConnect: string; cannotConnectMessage: string; enterCredentials: string;
  loginFailed: string; signUp: string; noAccountMobile: string; hasAccountMobile: string;
  language: string; switchToChinese: string; switchToEnglish: string; open: string;
  shareNotFound: string; verificationFailed: string; failedToLoad: string;
  failedToLoadFolders: string; uploadIntoFolder: string; chunkInfo: string;
  chooseFiles: string; searchResults: string; clearSearch: string;
  searching: string; noMatchingFiles: string; contents: string;
  refresh: string; folderEmpty: string; pauseResume: string;
  cancelAll: string; clearCompleted: string; folderLabel: string; select: string;
  newNamePrompt: string; expiresPrefix: string; colAdded: string;
  unknownFolder: string;
  emailPlaceholder: string; passwordPlaceholder: string;
  passwordCreatePlaceholder: string; namePlaceholder: string;
  accountCreated: string; redirectingToFiles: string;
  passwordStrengthStrong: string; passwordStrengthMedium: string;
  homeBadge: string; homeTitle: string; homeStart: string;
  /* Mobile redesign i18n */
  files: string; uploads: string; settings: string;
  addFiles: string; queued: string; completed: string; paused: string;
  history: string; clearHistory: string; noUploadsYet: string;
  uploadSubtitle: string; changePassword: string;
  updatePassword: string; updating: string; currentPassword: string;
  newPassword: string; confirmNewPassword: string;
  passwordsDoNotMatch: string; passwordUpdated: string;
  failedToChangePassword: string; minChars: string;
  signOutConfirm: string; moveItems: string;
  itemsSelected: string;
  removeFromHistory: string;
}

export interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: I18nStrings;
}