import styles from "./login.module.css";

export function LoginBrand() {
  return (
    <section className={styles.brandStage} aria-label="VIBE-HR 브랜드 소개">
      <div className={styles.brandFrame}>
        <div className={styles.brandFrameAccent} aria-hidden="true" />
        <div className={styles.brandMarkShell} aria-hidden="true">
          <svg className={styles.brandMark} viewBox="0 0 272 272" fill="none">
            <path className={styles.markLeft} d="M0 35h51v150l52-46 35 33-68 64H0V35Z" fill="var(--vibe-primary-login)" />
            <path className={styles.markRight} d="M222 35h50v201h-50v-63h-46l-55-52h101V35Z" fill="var(--vibe-login-steel)" />
          </svg>
        </div>

        <div className={styles.brandCopy}>
          <p className={styles.brandWordmark}>VIBE-HR</p>
          <h2 className={styles.brandTitle}>사람이 중심이 되는 HR의 시작</h2>
        </div>
      </div>
    </section>
  );
}
