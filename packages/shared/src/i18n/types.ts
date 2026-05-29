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
  aborted: string; uploadFailed: string; sessionFailed: string; parallelUploads: string;
  configureServer: string; tapToConfigure: string; serverLabel: string;
  cannotConnect: string; cannotConnectMessage: string; enterCredentials: string;
  loginFailed: string; signUp: string; noAccountMobile: string; hasAccountMobile: string;
  language: string; switchToChinese: string; switchToEnglish: string; open: string;
}

export interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: I18nStrings;
}