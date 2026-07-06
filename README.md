# Universal Knowledge Atlas 🌍

A free, multilingual, browser-based knowledge website designed for GitHub Pages.

The site lets users search for a **person, animal, place, monument, city, river, mountain, or other topic** and receive a clear result with:

- a short summary from Wikipedia,
- a representative image when available,
- a source link,
- a simple interactive map when coordinates are available,
- a navigation link to the location when relevant,
- a multilingual interface.

## Purpose

The goal of this project is to create a simple educational search tool that gathers essential public information in one friendly page. It is suitable for students, travelers, history lovers, geography lovers, nature lovers, and anyone who wants a fast visual overview of a topic.

## Current version

This is the first starter version. It includes:

- `index.html` as a single-page application.
- Hebrew interface by default.
- Language selector.
- Wikipedia summary search.
- Image display.
- Leaflet + OpenStreetMap map display.
- Google Maps route link when coordinates exist.
- Fully static frontend code, suitable for GitHub Pages.

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- Wikipedia APIs
- Leaflet
- OpenStreetMap map tiles
- GitHub Pages

## How to use

1. Open the website.
2. Type a search term, for example: `Eiffel Tower`, `Aristotle`, `Lion`, or `Jerusalem`.
3. Press **Search**.
4. Read the summary, view the image, and open the map or route if available.

## Notes

Some Wikipedia pages do not include geographic coordinates. In those cases, the result will still show text and image information, but the map will not point to an exact location. A future version can add OpenStreetMap/Nominatim geocoding for place-name lookup.

---

# אטלס ידע עולמי 🌍

אתר ידע חינמי, רב־לשוני, הפועל ישירות בדפדפן ומתאים לאחסון ב־GitHub Pages.

האתר מאפשר למשתמש לחפש **אדם, בעל חיים, מקום, מבנה, עיר, נהר, הר או נושא אחר**, ולקבל תוצאה ברורה עם:

- תקציר קצר מוויקיפדיה,
- תמונה מייצגת כאשר קיימת,
- קישור למקור המידע,
- מפה אינטראקטיבית פשוטה כאשר קיימות קואורדינטות,
- קישור לניווט כאשר מדובר במיקום,
- ממשק רב־לשוני.

## מטרת האתר

מטרת הפרויקט היא ליצור כלי חיפוש לימודי, פשוט ונוח, המרכז מידע ציבורי בסיסי בעמוד אחד ידידותי. האתר מתאים לתלמידים, מטיילים, חובבי היסטוריה, חובבי גאוגרפיה, חובבי טבע וכל מי שרוצה לקבל במהירות מידע חזותי וברור על נושא מסוים.

## הגרסה הנוכחית

זוהי גרסת התחלה ראשונה. היא כוללת:

- קובץ `index.html` כאפליקציית עמוד אחד.
- ממשק עברי כברירת מחדל.
- בורר שפות.
- חיפוש תקצירי ויקיפדיה.
- הצגת תמונה.
- הצגת מפה באמצעות Leaflet ו־OpenStreetMap.
- קישור למסלול ב־Google Maps כאשר קיימות קואורדינטות.
- קוד סטטי מלא שמתאים ל־GitHub Pages.

## טכנולוגיות

- HTML5
- CSS3
- JavaScript נקי
- ממשקי Wikipedia
- Leaflet
- OpenStreetMap
- GitHub Pages

## איך משתמשים?

1. נכנסים לאתר.
2. מקלידים שם, לדוגמה: `מגדל אייפל`, `אריסטו`, `אריה` או `ירושלים`.
3. לוחצים על **חפש**.
4. קוראים את התקציר, רואים את התמונה, ואם קיים מיקום — פותחים מפה או מסלול.

## הערות

לא לכל ערך בוויקיפדיה קיימות קואורדינטות. במקרים כאלה האתר יציג טקסט ותמונה, אך לא יצביע על מיקום מדויק במפה. בגרסה עתידית אפשר להוסיף חיפוש מיקום דרך OpenStreetMap/Nominatim.
