# 📋 HR Workflow Builder

> **PwC · 두산 HR AX** — As-is 프로세스 워크플로우 빌더

---

## 🚀 실행 방법

### 1단계: Node.js 설치 (최초 1회)

- 다운로드: https://nodejs.org/ko → **LTS 버전** 클릭하여 설치
- 설치 확인: 터미널/명령프롬프트에서 `node -v` 입력 → 버전 번호가 나오면 OK

---

### 2단계: 프로젝트 다운로드

#### 방법 A: Git Clone (권장)

```bash
git clone https://github.com/YOUR_USERNAME/hr-workflow-ai.git
cd hr-workflow-ai
```

#### 방법 B: ZIP 다운로드

1. 이 페이지 상단의 **Code** 버튼 → **Download ZIP** 클릭
2. ZIP 압축 해제 후 해당 폴더로 이동

---

### 3단계: 설치 & 실행

#### 🍎 Mac

터미널을 열고 아래 명령어를 순서대로 실행:

```bash
cd hr-workflow-ai
npm install --legacy-peer-deps
npm run dev
```

#### 🪟 Windows

> ⚠️ **반드시 아래 방법으로 "명령 프롬프트"를 여세요!**  
> Windows Terminal, PowerShell에서는 npm이 차단됩니다.

**명령 프롬프트(cmd) 여는 법:**
1. 키보드에서 **`Win + R`** 누르기 (Win = 윈도우 로고 키)
2. **`cmd`** 입력 후 **Enter**
3. **검은색 창**이 열리면 성공 ✅

> ❌ 파란색/보라색 창 = PowerShell (npm 차단됨)  
> ✅ 검은색 창 = 명령 프롬프트 (정상 작동)

열린 검은색 창에 아래 명령어를 한 줄씩 복사-붙여넣기:

```
cd %USERPROFILE%\Downloads\hr-workflow-ai
npm install --legacy-peer-deps
npm run dev
```

> 💡 `npm install`은 최초 1회만 실행 (2~3분 소요). 이후에는 `npm run dev`만 실행하면 됩니다.  
> 💡 압축 해제 경로가 다르면 `cd` 뒤의 경로를 실제 폴더 위치로 변경하세요.

---

### 4단계: 접속

- 브라우저에서 **http://localhost:3000** 접속
- 종료: 터미널에서 `Ctrl + C`

---

## 🔑 AI 기능 사용 (선택사항)

AI 워크플로우 생성 기능을 사용하려면 **OpenAI API Key**가 필요합니다.

프로젝트 폴더에 `.env.local` 파일을 생성하고 아래 내용을 입력:

```
OPENAI_API_KEY=sk-xxxx...
```

> API Key 없이도 CSV 업로드, 노드 편집, PPT 내보내기 등 대부분의 기능을 사용할 수 있습니다.

---

## 📖 주요 기능

| 기능 | 설명 |
|------|------|
| **CSV 업로드** | L2→L3→L4→L5 계층 CSV 파일 업로드 |
| **캔버스 편집** | 노드 드래그&드롭, 화살표 연결 |
| **노드 메타데이터** | 더블클릭 → 메모, 수행주체, I/O, 시스템 입력 |
| **양방향 화살표** | 화살표 우클릭 → 양방향 전환 |
| **AI Workflow** | 🤖 버튼 → AI가 자동으로 워크플로우 생성 |
| **내보내기** | PNG, SVG, PPT(네이티브), JSON 저장/불러오기 |

---

## 🎨 레벨별 색상

| 레벨 | 색상 | 용도 |
|------|------|------|
| **L2** | `#A62121` 🟥 | 대분류 (가장 진한) |
| **L3** | `#D95578` 🩷 | 중분류 |
| **L4** | `#F2A0AF` 🌸 | 소분류 |
| **L5** | `#F2DCE0` 🩰 | 세부항목 (가장 연한) |

---

*PwC · 두산 HR AX · 2026*
