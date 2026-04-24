import { html, raw } from "hono/html";

const CSS = `
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #22263a;
    --border: #2a2e3f;
    --text: #e8e9ed;
    --text-muted: #8b8fa3;
    --primary: #f97316;
    --font: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font); background: var(--bg); color: var(--text); min-height: 100vh; line-height: 1.6; }
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .container { max-width: 800px; margin: 0 auto; padding: 40px 24px; }
  .nav { margin-bottom: 40px; }
  .nav a { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 50px; background: var(--surface); border: 1px solid var(--border); font-size: 14px; font-weight: 600; color: var(--text-muted); transition: all .2s; }
  .nav a:hover { border-color: var(--primary); color: var(--text); text-decoration: none; }
  .content { background: var(--surface); padding: 40px; border-radius: 16px; border: 1px solid var(--border); }
  h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: 24px; color: #fff; }
  h2 { font-size: 1.5rem; font-weight: 700; margin-top: 32px; margin-bottom: 16px; color: #fff; }
  p { margin-bottom: 16px; color: var(--text-muted); }
  ul { margin-bottom: 16px; padding-left: 24px; color: var(--text-muted); }
  li { margin-bottom: 8px; }
  footer { text-align: center; padding: 40px 24px; color: var(--text-muted); font-size: 14px; }
  
  @media (max-width: 600px) {
    .content { padding: 24px; }
    h1 { font-size: 2rem; }
  }
`;

export function privacyPolicyPage() {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Privacy Policy - Resep Nusantara</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${raw(CSS)}</style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <a href="/">← Back to Home</a>
    </nav>
    <div class="content">
      <h1>Privacy Policy</h1>
      <p><strong>Effective Date:</strong> ${new Date().toISOString().split("T")[0]}</p>
      
      <p>This Privacy Policy applies to the "Resep Nusantara" Android application (Package Name: <code>com.plasodig.resep</code>) and its associated website <code>resep.plasodig.my.id</code> (collectively referred to as the "Service"), operated by Plasodig ("we", "us", or "our").</p>
      
      <h2>1. Information We Collect</h2>
      <p>We may collect information to provide and improve our Service. This includes:</p>
      <ul>
        <li><strong>Usage Data:</strong> We may collect non-personally identifiable information automatically, such as device type, operating system version, app usage statistics, and IP addresses for analytical purposes.</li>
        <li><strong>Advertising ID:</strong> For our Android application, we use Google AdMob to display advertisements. AdMob may collect and use your device's unique advertising identifier (Advertising ID) and other related information to provide personalized ads.</li>
        <li><strong>Search Queries:</strong> If you use the search or recipe request features within our Service, the content of your search terms may be stored to improve our recipe database.</li>
      </ul>

      <h2>2. How We Use Information</h2>
      <p>The information we collect is used for various purposes:</p>
      <ul>
        <li>To provide, maintain, and improve our Service.</li>
        <li>To monitor the usage of the Service for performance and error tracking.</li>
        <li>To serve personalized advertisements through Google AdMob in our Android app.</li>
      </ul>

      <h2>3. Third-Party Services</h2>
      <p>Our app uses <strong>Google AdMob</strong> to display ads. Google, as a third-party vendor, uses cookies or device identifiers to serve ads based on user interests. You can opt out of personalized advertising by visiting the Google Ads Settings on your Google account or within your Android device's advertisement settings (e.g., "Opt out of Ads Personalization").</p>
      <p>For more information on how Google handles data, please review the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a>.</p>

      <h2>4. Data Security</h2>
      <p>The security of your data is important to us, but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.</p>

      <h2>5. Children's Privacy</h2>
      <p>Our Service does not address anyone under the age of 13 ("Children"). We do not knowingly collect personally identifiable information from anyone under the age of 13. If you are a parent or guardian and you are aware that your Child has provided us with Personal Data, please contact us.</p>

      <h2>6. Changes to This Privacy Policy</h2>
      <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.</p>

      <h2>7. Contact Us</h2>
      <p>If you have any questions about this Privacy Policy, please contact us:</p>
      <ul>
        <li>Email: <a href="mailto:plasodig@gmail.com">plasodig@gmail.com</a></li>
        <li>Contact Page: <a href="/contacts">resep.plasodig.my.id/contacts</a></li>
      </ul>
    </div>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Resep Nusantara — <a href="https://resep.plasodig.my.id">resep.plasodig.my.id</a></p>
  </footer>
</body>
</html>`;
}

export function contactPage() {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Contact Us - Resep Nusantara</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${raw(CSS)}</style>
  <style>
    .contact-card { display: flex; align-items: center; gap: 16px; padding: 24px; background: var(--surface2); border-radius: 12px; margin-top: 24px; border: 1px solid var(--border); }
    .contact-icon { font-size: 32px; background: rgba(249,115,22,0.1); width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--primary); }
    .contact-info h3 { margin-bottom: 4px; color: #fff; font-size: 18px; }
    .contact-info p { margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <a href="/">← Back to Home</a>
    </nav>
    <div class="content">
      <h1>Contact Us</h1>
      <p>If you have any questions about the <strong>Resep Nusantara</strong> Android app or our website, please feel free to reach out to us. We will get back to you as soon as possible.</p>
      
      <div class="contact-card">
        <div class="contact-icon">✉️</div>
        <div class="contact-info">
          <h3>Email Us</h3>
          <p><a href="mailto:plasodig@gmail.com">plasodig@gmail.com</a></p>
        </div>
      </div>
      
      <div class="contact-card">
        <div class="contact-icon">🌐</div>
        <div class="contact-info">
          <h3>Website</h3>
          <p><a href="https://resep.plasodig.my.id">resep.plasodig.my.id</a></p>
        </div>
      </div>
      
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border);">
        <p><strong>App Package Name:</strong> <code>com.plasodig.resep</code></p>
        <p>Before emailing for support, please ensure you've read our <a href="/privacy-policy">Privacy Policy</a>.</p>
      </div>
    </div>
  </div>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Resep Nusantara — <a href="https://resep.plasodig.my.id">resep.plasodig.my.id</a></p>
  </footer>
</body>
</html>`;
}
