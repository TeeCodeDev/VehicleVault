# 🔔 Notificaties, Multi-User Delen & Verkoopdossier

---

## 1. Push- & E-mailnotificaties

VehicleVault controleert dagelijks op de achtergrond of er keuringen (APK / Autokeuring / TÜV), onderhoudsintervallen of documenten (zoals een groene kaart of verzekeringspolis) binnen **30 dagen** of **7 dagen** verlopen.

Onder **Instellingen ➔ Notificaties & Integraties** heb je keuze uit **5 ondersteunde diensten**:

1. **Pushover:** Vul je *Pushover User Key*, *Application API Token* en optioneel een *Device Name* in voor directe pushmeldingen op iOS en Android.
2. **Ntfy.sh:** Ondersteunt zowel de publieke `https://ntfy.sh/jouw-topic` als een zelf-gehoste Ntfy-server (met optioneel Bearer token).
3. **Gotify:** Verbind met je eigen Gotify-server via URL en App Token.
4. **Custom Webhook:** Stuur JSON-payloads rechtstreeks naar Discord, Slack, Telegram of een Home Assistant Webhook.
5. **E-mail (SMTP):** Stuur opgemaakte HTML-waarschuwingen én wachtwoord-resetmails via je eigen SMTP-server.

Gebruik de knop **Testmelding Versturen** om je configuratie direct te controleren.

---

## 2. Multi-User Rollen & Voertuigen Delen

### Gebruikersrollen
- **Admin (Beheerder):** Volledige toegang tot alle systeeminstellingen, AI-sleutels, notificaties, backups en gebruikersbeheer.
- **User (Gebruiker):** Kan eigen voertuigen beheren, documenten uploaden, onderhoud registreren en voertuigen delen.
- **Driver (Chauffeur):** Vereenvoudigde mobiele weergave specifiek gericht op snel tanken en ritten registreren onderweg.

### Voertuig Delen met Gezinsleden
Klik in **Mijn Garage** op het **Deel-icoon (`Users`)** bij een voertuig om een ander account toegang te geven:
- **Bewerker (`Editor`):** Mag tankbeurten, ritten en onderhoud toevoegen en bewerken.
- **Alleen-lezen (`Viewer`):** Mag het dossier, de documenten en statistieken inzien zonder wijzigingen aan te brengen.

---

## 3. Verkooppagina & Standalone Website Export (`Showcase`)

Ga je je auto verkopen? Via **Mijn Garage ➔ Verkooppagina & Showcase** maak je met één klik een professioneel, transparant verkoopdossier aan:
- **Publieke Deellink (`/showcase/:slug`):** Deel een nette link op Marktplaats, AutoScout24 of via WhatsApp met vraagprijs, fotogalerij, RDW-specificaties, geverifieerde onderhoudshistorie, profieldieptes van de banden en directe contactknoppen (WhatsApp / Bellen / E-mail).
- **1-Klik Standalone Website (.zip):** Download een compleet, statisch HTML/CSS/JS website-pakket inclusief alle geoptimaliseerde foto's. Deze `.zip` kun je zonder database of backend direct uploaden naar elk eigen domein, webhostingpakket, GitHub Pages of Cloudflare Pages!
