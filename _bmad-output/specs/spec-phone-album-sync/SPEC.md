---
id: SPEC-phone-album-sync
companions: []
sources: []
---

> **规范约定（Canonical contract）。** 本文档及 `companions:` 中列出的文件，是后续构建、测试和验证的完整、经过保全校验的契约。`sources:` 中列出的原始文档仅用于追溯——如果你需要叙事性背景或原文细节，请查阅它们，本契约有意省略了这些。

# 手机相册智能同步 — 设备文件夹组织

## Why

用户在同步手机相册到 NAS 时，所有照片直接上传到根目录或按日期平铺，没有按设备来源做文件夹隔离。当有多台手机（或个人换机后）同步时，照片混在一起难以管理。需要一个按设备型号自动归类的能力，让每台手机的同步照片天然分文件夹存放，且同步流程对用户友好、可配置。

## Capabilities

- id: CAP-1
  intent: 系统自动检测当前手机的设备型号（品牌 + 型号），并拼接成文件夹名称（如 `XIAOMI_15_DCIM`）。
  success: 在任意 Android 手机上打开 App 并触发相册同步时，移动端能通过 `expo-device` 获取到正确的品牌和型号，拼接出唯一文件夹名。

- id: CAP-2
  intent: 用户首次同步时看到检测到的照片数量 + 即将同步到的设备文件夹名称，确认后再开始上传。
  success: 界面流程为：发现 N 张照片 → 点击同步 → 展示文件夹名 "XIAOMI_15_DCIM" → 用户点击确认 → 开始上传。用户点「取消」则不执行同步。

- id: CAP-3
  intent: 同一设备后续的增量同步自动使用同一文件夹，不再重复确认。
  success: 设备型号存入 AsyncStorage，再次检测到新照片后直接同步到同一个设备文件夹，无需用户再次确认文件夹名。

- id: CAP-4
  intent: 同步的照片在文件管理中以独立文件夹形式可见，用户可通过 Files 标签页浏览该设备同步的所有照片。
  success: 后台为设备文件夹创建对应的 `Folder` 数据库记录，上传照片的 `File` 记录 `folderId` 指向该文件夹。用户在 Files 中能看到并进入该文件夹。

- id: CAP-5
  intent: 用户在设置页面可以开关「自动检测同步」功能，关闭后 App 不再自动扫描和提示相册同步；重新打开后恢复正常检测。
  success: Settings 页面增加一个 Switch 开关「自动检测同步」，默认开启。关闭后 `usePhotoDetection` 不触发扫描，也不弹出同步提示。重新打开开关后，进入照片 Tab 自动触发扫描，继续检测并展示可同步的新照片。

- id: CAP-6
  intent: 后端按设备型号组织存储路径，确保文件系统层级清晰。
  success: 存储路径从 `{PHOTO_ROOT}/{username}/{YYYY}/{MM}/{uuid}.{ext}` 变为 `{PHOTO_ROOT}/{username}/{deviceModel}/{YYYY}/{MM}/{uuid}.{ext}`，且兼容无 deviceModel 的旧数据。

## Constraints

- 必须兼容已存在的照片数据。未携带 deviceModel 的旧照片应正常工作，不改变其存储路径。
- 设备型号检测必须使用 `expo-device`（已存在于项目依赖），不加其他原生依赖。
- 文件夹名格式统一为 `{BRAND}_{MODEL}_DCIM`，品牌和型号转大写，去除非字母数字字符。
- 增量同步的上传流程复用现有的 `PhotoUploadContext` + `UploadQueue` 机制，不重新发明上传管道。
- 设置开关状态存储在 AsyncStorage 中，不占用后端存储。

## Non-goals

- 不支持用户手动修改设备文件夹名（当前 Phase 1，后续可通过重命名功能支持）。
- 不支持跨设备合并照片到同一文件夹。
- 不处理 iOS 设备的相册同步（Phase 1 仅 Android）。
- 不删除或迁移旧的、已存储在根目录的照片。
- 不支持用户选择同步到哪个文件夹（固定使用自动检测的设备文件夹名）。

## Success signal

某用户使用小米 15 手机打开 App，相册检测到 42 张新照片，点击同步后看到「照片将同步到 XIAOMI_15_DCIM 文件夹」提示，确认后 42 张照片全部上传完成。在 Files 标签页中能看到 `XIAOMI_15_DCIM` 文件夹，进入后可浏览所有同步照片。关闭「自动检测同步」开关后，App 不再弹出同步提示。
