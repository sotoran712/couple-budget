# 우리집 가계부

Supabase에 저장되는 부부용 웹 가계부입니다.

## Supabase 준비

1. Supabase SQL Editor에서 `supabase-setup.sql` 내용을 실행합니다.
2. Authentication > Sign In / Providers에서 Email 로그인을 켭니다.
3. Project Settings > Data API에서 아래 값을 확인합니다.
   - Project URL
   - publishable key

## 사용 순서

1. `index.html`을 열거나 Vercel에 배포합니다.
2. 첫 화면에 Project URL과 publishable key를 입력합니다.
3. 한 사람이 회원가입/로그인 후 `우리집 만들기`를 누릅니다.
4. 화면에 나온 초대 코드를 배우자에게 공유합니다.
5. 배우자는 회원가입/로그인 후 초대 코드를 입력합니다.

## 배포

GitHub 저장소에 이 폴더 내용을 올리고 Vercel에서 Import Project를 선택하면 됩니다.
