// Joubes — construction du site.
// Lit les fauteuils (contenu/fauteuils/*.json) et les réglages (contenu/reglages.json),
// puis fabrique le site complet dans le dossier "public/".
// Lancé automatiquement par Cloudflare Pages à chaque modification (commande : node build.js).
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
const SORTIE = path.join(RACINE, 'public');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

// ---------- Outils
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const vide = (s) => !s || !String(s).trim();
const slugDe = (f) => path.basename(f, '.json');
function copierDossier(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copierDossier(a, b); else fs.copyFileSync(a, b);
  }
}

// ---------- Données
const R = JSON.parse(lire('contenu/reglages.json'));
const DOMAINE = String(R.domaine || 'https://joubes.fr').replace(/\/+$/, '');
const JETONS = {
  '{{DOMAINE}}': DOMAINE,
  '{{TELEPHONE}}': esc(R.telephone),
  '{{TELEPHONE_INTL}}': esc(String(R.telephone_international || '').replace(/\s+/g, '')),
  '{{EMAIL}}': esc(R.email),
  '{{CLE_WEB3FORMS}}': esc(R.cle_web3forms),
};
const jetons = (s) => Object.entries(JETONS).reduce((acc, [k, v]) => acc.split(k).join(v), s);

const dossierF = path.join(RACINE, 'contenu/fauteuils');
const fauteuils = fs.readdirSync(dossierF).filter((f) => f.endsWith('.json')).map((f) => {
  const d = JSON.parse(fs.readFileSync(path.join(dossierF, f), 'utf8'));
  return { ...d, slug: slugDe(f), photos: Array.isArray(d.photos) ? d.photos : [] };
}).filter((f) => f.en_ligne !== false && !vide(f.nom))
  .sort((a, b) => (Number(a.ordre) || 999) - (Number(b.ordre) || 999) || a.nom.localeCompare(b.nom, 'fr'));

const alaUne = (() => { const u = fauteuils.filter((f) => f.a_la_une); return (u.length ? u : fauteuils).slice(0, 4); })();
const altDe = (f) => esc(vide(f.description_photo) ? `Fauteuil ${f.nom}` : f.description_photo);
const photoDe = (f) => esc(vide(f.photo) ? '/images/logo.svg' : f.photo);
const statut = (f) => (f.disponibilite && f.disponibilite !== 'Disponible') ? `<p class="statut">${esc(f.disponibilite)}</p>` : '';

// ---------- Gabarits communs
function tete({ titre, description, chemin, noindex = false, ld = null }) {
  const url = DOMAINE + chemin;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="canonical" href="${url}">
<meta name="theme-color" content="#F1F0EC">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Joubes">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${DOMAINE}/images/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/italiana.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/manrope.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/style.css">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n` : ''}</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
`;
}
function entete(courant) {
  const l = (href, txt, cle) => `<a href="${href}"${cle === courant ? ' aria-current="page"' : ''}>${txt}</a>`;
  return `<header class="site-header">
<div class="wrap">
<a class="logo" href="/" aria-label="Joubes, accueil"><img src="/images/logo.svg" alt="Joubes" width="148" height="64"></a>
<nav class="nav" aria-label="Navigation principale">
${l('/collection', 'Collection', 'collection')}
${l('/atelier', "L'atelier", 'atelier')}
<a href="/#contact">Contact</a>
<a class="btn" href="/#contact">Contacter le vendeur</a>
</nav>
</div>
</header>
`;
}
const PIED = `<footer class="site-footer">
<div class="wrap">
<div>
<img src="/images/logo-clair.svg" alt="Joubes" width="166" height="72" loading="lazy">
<p>Mobilier et fauteuils</p>
</div>
<nav aria-label="Pied de page">
<ul>
<li><a href="/collection">Collection</a></li>
<li><a href="/atelier">L'atelier</a></li>
<li><a href="/#contact">Contact</a></li>
<li><a href="/mentions-legales">Mentions légales et CGU</a></li>
</ul>
</nav>
<small>© ${new Date().getFullYear()} Joubes</small>
</div>
</footer>
`;
const fin = (js = '') => PIED + js + '</body>\n</html>\n';

function formulaire(message = '', fauteuil = null) {
  return `<form class="formulaire" action="https://api.web3forms.com/submit" method="post">
<h3>Contactez le vendeur</h3>
<p class="note">Tous les champs sont obligatoires.</p>
<input type="hidden" name="access_key" value="{{CLE_WEB3FORMS}}">
<input type="hidden" name="subject" value="Nouveau message depuis le site Joubes">
<input type="hidden" name="from_name" value="Site Joubes">
<input type="hidden" name="redirect" value="{{DOMAINE}}/merci">${fauteuil ? `\n<input type="hidden" name="fauteuil" value="${esc(fauteuil)}">` : ''}
<input type="checkbox" name="botcheck" class="piege" tabindex="-1" autocomplete="off" aria-hidden="true">
<label>Nom
<input type="text" name="name" autocomplete="name" required></label>
<label>E-mail
<input type="email" name="email" autocomplete="email" required></label>
<label>Votre message
<textarea name="message" rows="4" required>${esc(message)}</textarea></label>
<button class="btn btn-plein" type="submit">Envoyer le message</button>
<p class="rgpd">Vos données servent uniquement à répondre à votre demande. <a href="/mentions-legales#donnees">En savoir plus</a></p>
</form>`;
}
function blocContact(titre, intro, message = '', fauteuil = null) {
  return `<section id="contact" class="sombre section" aria-labelledby="contact-titre">
<div class="wrap contact">
<div>
<h2 id="contact-titre">${titre}</h2>
<p class="intro">${intro}</p>
<dl class="coordonnees">
<div><dt>Téléphone</dt><dd><a href="tel:{{TELEPHONE_INTL}}">{{TELEPHONE}}</a></dd></div>
<div><dt>E-mail</dt><dd><a href="mailto:{{EMAIL}}">{{EMAIL}}</a></dd></div>
</dl>
</div>
${formulaire(message, fauteuil)}
</div>
</section>
`;
}
function carte(f, niveau = 'h3', paresseux = true) {
  return `<li><a class="carte" href="/fauteuil-${f.slug}">
<img src="${photoDe(f)}" alt="${altDe(f)}" width="600" height="750"${paresseux ? ' loading="lazy"' : ''}>
<${niveau}>${esc(f.nom)}</${niveau}>
${statut(f)}</a></li>`;
}
const fil = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([n, p], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: DOMAINE + p })) });

// ---------- Pages
const pages = {};

const hero = alaUne[0];
pages['index.html'] = tete({ titre: 'Joubes — Fauteuils de style relookés',
  description: 'Joubes relooke des fauteuils de style : pièces uniques restaurées et habillées à la main. Découvrez la collection et contactez le vendeur.',
  chemin: '/', ld: { '@context': 'https://schema.org', '@type': 'Organization', name: 'Joubes', url: DOMAINE + '/', logo: DOMAINE + '/images/logo.svg',
    description: 'Fauteuils de style relookés à la main, pièces uniques.', email: R.email, telephone: R.telephone } })
+ entete() + `<main id="contenu" tabindex="-1">
<section class="wrap hero" aria-labelledby="titre-accueil">
<div class="hero-texte">
<h1 id="titre-accueil">Fauteuils de style, relookés</h1>
<p class="muted">Joubes redonne vie à des fauteuils anciens : structure remise en état, garnissage refait et tissus choisis pour aujourd'hui. Chaque pièce est unique.</p>
<div class="btns">
<a class="btn btn-plein" href="/collection">Collection</a>
<a class="btn" href="#contact">Contact</a>
</div>
</div>
${hero ? `<a class="hero-visuel" href="/fauteuil-${hero.slug}">
<img src="${photoDe(hero)}" alt="${altDe(hero)}" width="1200" height="1200" fetchpriority="high">
<span class="hero-legende"><strong>Fauteuil ${esc(hero.nom)}</strong><span class="muted">Voir le fauteuil</span></span>
</a>` : ''}
</section>
<section class="section bordure" aria-labelledby="titre-collection">
<div class="wrap">
<div class="titre-section">
<h2 id="titre-collection">La collection</h2>
<p class="muted">Les prix sont communiqués sur demande. Contactez-nous pour un fauteuil qui vous plaît, nous vous répondons rapidement.</p>
</div>
${alaUne.length ? `<ul class="grille">\n${alaUne.map((f) => carte(f)).join('\n')}\n</ul>` : '<p class="muted">De nouveaux fauteuils arrivent bientôt.</p>'}
<p class="lien-suite"><a class="btn" href="/collection">Toute la collection</a></p>
</div>
</section>
<section class="section craie" aria-labelledby="titre-atelier">
<div class="wrap atelier-resume">
<div>
<h2 id="titre-atelier">L'atelier</h2>
<p class="muted">Nous chinons des fauteuils de style et les relookons un à un, en gardant ce qui fait leur caractère et en refaisant ce qui doit l'être.</p>
<a class="btn" href="/atelier">Découvrir l'atelier</a>
</div>
<ul class="lignes">
<li><h3>La structure</h3><p class="muted">[Essence de bois, mode d'assemblage, origine]</p></li>
<li><h3>Le garnissage</h3><p class="muted">[Type de mousse ou de crin, suspension, confort d'assise]</p></li>
<li><h3>Les tissus</h3><p class="muted">[Gammes proposées : lin, velours, bouclé… et délais de confection]</p></li>
</ul>
</div>
</section>
${blocContact('Contact', 'Une question sur un fauteuil ? Écrivez-nous ou appelez-nous, nous vous répondons rapidement.')}</main>
` + fin();

pages['collection.html'] = tete({ titre: 'Collection de fauteuils de style relookés — Joubes',
  description: 'Tous les fauteuils de style relookés par Joubes : pièces uniques restaurées à la main, prix sur demande.',
  chemin: '/collection', ld: fil([['Accueil', '/'], ['Collection', '/collection']]) })
+ entete('collection') + `<main id="contenu" tabindex="-1" class="section">
<div class="wrap">
<div class="titre-section">
<h1>La collection</h1>
<p class="muted">Tous nos fauteuils relookés. Cliquez sur un fauteuil pour voir ses détails.</p>
</div>
${fauteuils.length ? `<ul class="grille">\n${fauteuils.map((f, i) => carte(f, 'h2', i > 3)).join('\n')}\n</ul>` : '<p class="muted">De nouveaux fauteuils arrivent bientôt.</p>'}
</div>
</main>
` + fin();

const CARAC = [['dimensions', 'Dimensions'], ['hauteur_assise', "Hauteur d'assise"], ['structure', 'Structure'], ['tissu', 'Tissu'], ['travaux', 'Travaux réalisés']];
for (const f of fauteuils) {
  const nom = esc(f.nom);
  const sous = [f.style, f.epoque].filter((x) => !vide(x)).map(esc).join(', ');
  const paras = String(f.description || '').split(/\n\s*\n/).filter((p) => !vide(p)).map((p) => `<p class="muted">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('\n');
  const lignes = CARAC.filter(([k]) => !vide(f[k])).map(([k, l]) => `<div><dt>${l}</dt><dd>${esc(f[k])}</dd></div>`);
  lignes.push(`<div><dt>Disponibilité</dt><dd>${esc(f.disponibilite || 'Disponible')}</dd></div>`);
  const autres = f.photos.filter((p) => p && !vide(p.image));
  const vignettes = autres.length ? `<div class="vignettes" role="group" aria-label="Autres photos">
${[{ image: f.photo, description: f.description_photo }, ...autres].map((p, i) => {
    const alt = esc(vide(p.description) ? `Fauteuil ${f.nom}, photo ${i + 1}` : p.description);
    return `<button type="button" aria-pressed="${i === 0}" data-src="${esc(p.image)}" data-alt="${alt}"><img src="${esc(p.image)}" alt="${alt}" width="300" height="300" loading="lazy"></button>`;
  }).join('\n')}
</div>` : '';
  pages[`fauteuil-${f.slug}.html`] = tete({ titre: `Fauteuil ${f.nom} — Joubes`,
    description: `Fauteuil ${f.nom} relooké par Joubes : dimensions, structure, tissu et travaux réalisés. Pièce unique, contactez le vendeur.`,
    chemin: `/fauteuil-${f.slug}`, ld: fil([['Accueil', '/'], ['Collection', '/collection'], [`Fauteuil ${f.nom}`, `/fauteuil-${f.slug}`]]) })
  + entete() + `<main id="contenu" tabindex="-1">
<nav class="wrap fil" aria-label="Fil d'Ariane">
<ol><li><a href="/collection">Collection</a></li><li><span aria-current="page">${nom}</span></li></ol>
</nav>
<div class="wrap fiche">
<div class="galerie">
<img class="galerie-principale" id="photo-principale" src="${photoDe(f)}" alt="${altDe(f)}" width="1200" height="1200" fetchpriority="high">
${vignettes}
</div>
<div class="fiche-infos">
<div>
<h1>${nom}</h1>
${sous ? `<p class="muted sous-titre">${sous}</p>` : ''}
</div>
${paras}
<dl class="caracteristiques">
${lignes.join('\n')}
</dl>
<div class="btns">
<a class="btn btn-plein" href="#contact">Contacter le vendeur</a>
<a class="btn" href="tel:{{TELEPHONE_INTL}}">Appeler</a>
</div>
</div>
</div>
${blocContact('Ce fauteuil vous plaît ?', 'Écrivez-nous ou appelez-nous pour en savoir plus sur ce fauteuil.', `Bonjour, le fauteuil ${f.nom} m'intéresse.`, `Fauteuil ${f.nom}`)}</main>
` + fin(autres.length ? '<script src="/js/galerie.js" defer></script>\n' : '');
}

const FIXES = [
  ['atelier.html', "L'atelier, savoir-faire et matières — Joubes", "L'atelier Joubes : le savoir-faire et le travail de la matière derrière chaque fauteuil de style relooké, du bois au tissu.", '/atelier', false, 'atelier', fil([['Accueil', '/'], ["L'atelier", '/atelier']])],
  ['mentions-legales.html', 'Mentions légales et CGU — Joubes', "Mentions légales, conditions générales d'utilisation et politique de données personnelles du site Joubes.", '/mentions-legales', false, null, null],
  ['merci.html', 'Message envoyé — Joubes', 'Votre message a bien été envoyé à Joubes.', '/merci', true, null, null],
  ['404.html', 'Page introuvable — Joubes', "Cette page n'existe pas ou a été déplacée.", '/404', true, null, null],
];
for (const [fichier, titre, description, chemin, noindex, courant, ld] of FIXES) {
  pages[fichier] = tete({ titre, description, chemin, noindex, ld }) + entete(courant) + lire(path.join('modeles', fichier)) + fin();
}

// ---------- Écriture
fs.rmSync(SORTIE, { recursive: true, force: true });
copierDossier(path.join(RACINE, 'static'), SORTIE);
for (const [fichier, html] of Object.entries(pages)) fs.writeFileSync(path.join(SORTIE, fichier), jetons(html));

const urls = ['/', '/collection', '/atelier', ...fauteuils.map((f) => `/fauteuil-${f.slug}`), '/mentions-legales'];
fs.writeFileSync(path.join(SORTIE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${DOMAINE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(SORTIE, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${DOMAINE}/sitemap.xml\n`);

console.log(`Site construit : ${fauteuils.length} fauteuil(s) en ligne, ${Object.keys(pages).length} pages.`);
