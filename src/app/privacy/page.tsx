export const metadata = { title: "Privacy" };
export default function Privacy() {
  return (
    <article className="container-x py-12 max-w-2xl [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3 [&_p]:text-muted [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted">
      <h1 className="text-3xl sm:text-4xl font-semibold">Privacy notice</h1>
      <p className="!text-ink">Draft for launch. Have a lawyer review it against India’s Digital Personal Data Protection Act, 2023 before you publicise the site.</p>
      <h2>What we collect</h2>
      <ul><li>Your email, password (stored only as a one-way hash) and optional name.</li><li>Body measurements and fit preference you choose to enter.</li><li>Recommendations you save and fit feedback you send.</li></ul>
      <p>We do not collect photos. We do not sell your data.</p>
      <h2>Why</h2>
      <p>To recommend clothing sizes to you and to improve those recommendations. Measurements are only shown to you.</p>
      <h2>Your controls</h2>
      <ul><li>Edit your measurements any time.</li><li>Download your data from Settings.</li><li>Delete your measurements, or your whole account, from Settings. Deletion is immediate and permanent.</li></ul>
      <h2>Contact</h2>
      <p>Add your grievance contact email here before launch.</p>
    </article>
  );
}
