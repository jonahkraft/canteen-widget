// you can add custom configs to the list and select your config via the widget parameter (the parameter should be the index)
// do not delete the default config

const CONFIGS = Object.freeze([
    {
        activeCanteens: ["Zentralmensa"],
        fallbackCanteens: ["Bambus"],
        fillUpWithFallback: false,
        language: "german",
        gradientColors: ["bde0fe", "a2d2ff"],
        openURL: "https://ves.uni-mainz.de/de/mensa",
        showPrices: true,
        showSideDishes: false,
        alwaysShowSaladBar: false,
        addBulletPoints: false,
        useDiscountedPrices: true,
        userAllergens: [],
        textColor: "000000",
        errorColor: "ff0000",
        headerColor: "000000",
        switchToTomorrowTime: 18
    }
])

// -----------------------------------------------------------------

// types

/**
 * @typedef {Object} MealData
 * @property {number} id
 * @property {number} servings_id
 * @property {string} date
 * @property {{german: string, english: string}} name
 * @property {{discounted: number, normal: number}} prices
 * @property {string} allergens
 * @property {string} markings
 * @property {{likes: number, dislikes: number}} rating
 * @property {{[key: string]: string}} images
 * @property {{german: string, english: string} | null} recommendation
 * @property {number} number_comments
 */

/**
 * @typedef {MealData[]} CounterData
 */

/**
 * @typedef {{[counter: string]: CounterData}} CanteenData
 */

/**
 * @typedef {{[canteen: string]: CanteenData}} DateData
 */

/**
 * @typedef {{[date: string]: DateData}} PlanData
 */

/**
 * @typedef {{status: string, plan: PlanData}} RawJSONData
 */

/**
 * @typedef {{[canteen: string]: {[counter: string]: string[]}}} CanteenCounterItems
 */

// -----------------------------------------------------------------

// global variables - do not edit

const ARGS = args.widgetParameter;
let CONFIG_INDEX = isValidIndex(ARGS) ? Number(ARGS) : 0;
const ACTIVE_CONFIG = CONFIGS[CONFIG_INDEX];
const FULL_ALLERGEN_NAMES = Object.freeze({
    "1": ["Farbstoffe", "Colorants"],
    "2": ["Konservierungsstoffe", "Preservatives"],
    "3": ["Antioxidationsmittel", "Antioxidants"],
    "4": ["Geschmacksverstärker", "Flavour enhancers"],
    "5": ["Geschwefelt", "Sulphurised"],
    "6": ["Geschwärzt", "Blackened"],
    "7": ["Gewachst", "Waxed"],
    "8": ["Phosphat", "Phosphate"],
    "9": ["Süßungsmittel", "Sweetener"],
    "10": ["Phenylalaninquelle", "phenylalanine source"],
    "Ho": ["Honig", "Honey"],
    "S": ["Schweinefleisch", "Pork"],
    "G": ["Geflügelfleisch", "Poultry meat"],
    "R": ["Rindfleisch", "Beef"],
    "Gl": ["Gluten", "Gluten"],
    "We": ["Weizen (inkl. Dinkel)", "Wheat flour (incl. spelt)"],
    "Ro": ["Roggen", "Rye"],
    "Ge": ["Gerste", "Barley"],
    "Haf": ["Hafer", "Oats"],
    "Kr": ["Krebstiere", "Shellfish"],
    "Ei": ["Eier", "Eggs"],
    "Fi": ["Fisch", "Fish"],
    "En": ["Erdnüsse", "Peanuts"],
    "So": ["Soja", "Soya"],
    "La": ["Milch", "Milk"],
    "Sl": ["Sellerie", "Celery"],
    "Sf": ["Senf", "Mustard"],
    "Se": ["Sesamsamen", "Sesame"],
    "Sw": ["Schwefeldioxid und Sulfite", "Sulphur dioxides and sulphites"],
    "Lu": ["Lupine", "Lupine"],
    "Wt": ["Weichtiere", "Molluscs"],
    "Nu": ["Schalenfrüchte", "Nuts"],
    "Man": ["Mandel", "Almond"],
    "Has": ["Haselnüsse", "Hazelnuts"],
    "Wa": ["Walnüsse", "Walnuts"],
    "Ka": ["Kaschunüsse", "Cashews"],
    "Pe": ["Pecannüsse", "Pecans"],
    "Pa": ["Paranüsse", "Brazil nuts"],
    "Pi": ["Pistazien", "Pistachios"],
    "Mac": ["Macadamianüsse", "Macadamia nuts"]
});
const COLORS = Object.freeze({
    headerColor: new Color(ACTIVE_CONFIG.headerColor),
    textColor: new Color(ACTIVE_CONFIG.textColor),
    errorColor: new Color(ACTIVE_CONFIG.errorColor)
});
const TRANSLATIONS = Object.freeze({
    english: {
        errorMessage: "Could not load canteen-data.",
        noMenuToday: "There is no menu available for today.",
        noMenuTomorrow: "There is no menu available for tomorrow.",
        allergenMessage: "Currently active allergen filters:",
        title: "Menu"
    },
    german: {
        errorMessage: "Mensa-Daten konnten nicht geladen werden.",
        noMenuToday: "Für heute ist kein Menü verfügbar.",
        noMenuTomorrow: "Für morgen ist kein Menü verfügbar.",
        allergenMessage: "Folgende Allergenfilter sind aktiviert:",
        title: "Speiseplan"
    }
});
const FILE_MANAGER = FileManager.local();
const SCRIPT_DIRECTORY = createLocalDirectory();
const MEAL_DATA_PATH = FILE_MANAGER.joinPath(SCRIPT_DIRECTORY, "meal_data.json");

// -----------------------------------------------------------------

await main();
Script.complete();

// -----------------------------------------------------------------

// Functions to analyze the data

/**
 * Fetches the data of the whole menu for the next days from the API.
 *
 * @async
 * @returns {Promise<RawJSONData|null>} A promise that resolves to the JSON data fetched from the API or null on failure.
 * Caller must validate the data and handle errors (if null is returned)
*/
async function fetchCanteenData() {
    try {
        const request = new Request("https://ves.uni-mainz.de/services/python/spaiseplan/plan");
        const data = await request.loadJSON();

        if (!isValidCanteenData(data)) return null;

        return data;

    } catch (error) {
        console.error("fetchCanteenData failed:", error)
        return null;
    }
}

/**
 * Performs a simple validation if the data fetched from the API has the right format
 * @param {any} data
 * @returns {boolean}
 */
function isValidCanteenData(data) {
    return (
        data?.plan &&
            typeof data.plan === "object" &&
            Object.keys(data.plan).length > 0
    );
}

/**
 * Fetches the data for all meals on the specified day.
 * @async
 * @param {Date} date
 * @returns {Promise<DateData|null>} data for the current day and null if there is no valid data
 */
async function fetchAllMeals(date) {
    const data = await fetchCanteenData();

    if (!data) return null;

    const allMeals = data["plan"][formatDate(date)];

    // the type is undefined if there is no data for today (data["plan"][format(date)] does not exist then)
    // if so, return an empty object to make clear that there is no data
    return allMeals ?? {};
}

/**
 * Tries to fetch the menu data from the API. Falls back to local data if this fails
 * @param {Date} date
 * @returns {Promise<DateData|null>}
 */
async function getMenuData(date) {
    const remoteData = await fetchAllMeals(date);
    if (remoteData) return remoteData;

    const localData = loadDateData(date);
    if (localData) return localData;

    return null;
}

/**
 * Extracts all meal descriptions for all counters in one canteen respecting config filters (showSideDishes, allergens, language)
 * @param {CanteenData} canteenData
 * @returns {{[counter: string]: string[]}} Object mapping counter names to lists of meal descriptions
*/
function extractCanteenMeals(canteenData) {
    const mealsByCounter = {};
    const counterNames = Object.keys(canteenData).sort();
    const language = ACTIVE_CONFIG.language;

    for (const counterName of counterNames) {
        const validMeals = [];

        // ignore side dishes if specified
        if (counterName === "Beilagen" && !ACTIVE_CONFIG.showSideDishes) continue;

        const counterMeals = canteenData[counterName];

        for (const meal of counterMeals) {
            const mealName = meal.name[language];
            const allergens = meal.allergens;

            // don't add meals which include allergens that the user blacklists
            if (!isMealValid(mealName, allergens)) continue;

            validMeals.push(getMealDescription(meal));
        }
        if (validMeals.length > 0) {
            mealsByCounter[counterName] = validMeals;
        }
    }
    return mealsByCounter;
}

/**
 * Extracts all meals from the specified day
 * @param {DateData} currentMenu
 * @returns {CanteenCounterItems} Object mapping canteen names to objects that map
 * counter names to lists of meal descriptions
 */
function extractAllMeals(currentMenu) {
    const {validMealsByCanteen, fallbackMealsByCanteen} = getMealsByType(currentMenu);

    if (!ACTIVE_CONFIG.fillUpWithFallback) {
        // use the meals from the fallback canteens only if there is no data from the active canteens
        return Object.keys(validMealsByCanteen).length > 0 ? validMealsByCanteen : fallbackMealsByCanteen;
    }
    return mergeMealsWithFallback(validMealsByCanteen, fallbackMealsByCanteen);
}

/**
 * Merges the data from the user selected canteens with the fallback canteens until the amount of specified canteens is
 * reached
 * @param {CanteenCounterItems} validMealsByCanteen
 * @param {CanteenCounterItems} fallbackMealsByCanteen
 * @returns {CanteenCounterItems}
 */
function mergeMealsWithFallback(validMealsByCanteen, fallbackMealsByCanteen) {
    let remainingSlots = ACTIVE_CONFIG.activeCanteens.length - Object.keys(validMealsByCanteen).length;

    for (const fallbackCanteenName of ACTIVE_CONFIG.fallbackCanteens) {
        if (remainingSlots <= 0) break;
        if (fallbackCanteenName in validMealsByCanteen) continue;

        const fallBackData = fallbackMealsByCanteen[fallbackCanteenName];

        if (fallBackData) {
            validMealsByCanteen[fallbackCanteenName] = fallBackData;
            remainingSlots --;
        }
    }
    return validMealsByCanteen;
}

/**
 * Extracts all meals from canteens that are either selected as active canteens by the user or selected as fallback
 * Returns an object that contains both as nested objects that map canteen names to counter names and then counter names
 * to lists of meal descriptions
 * @param {DateData} currentMenu
 * @returns {{validMealsByCanteen: CanteenCounterItems, fallbackMealsByCanteen: CanteenCounterItems}}
 */
function getMealsByType(currentMenu) {
    const fallbackMealsByCanteen = {};
    const validMealsByCanteen = {};

    for (const canteenName of Object.keys(currentMenu)) {
        const canteenData = currentMenu[canteenName];

        // skip if canteen has no data
        if (!canteenData) continue;

        const isActive = ACTIVE_CONFIG.activeCanteens.includes(canteenName);
        const isFallBack = ACTIVE_CONFIG.fallbackCanteens.includes(canteenName);

        // skip canteens that are neither active nor fallback
        if (!isActive && !isFallBack) continue;

        const mealsByCounter = extractCanteenMeals(canteenData);

        if (isActive) {
            validMealsByCanteen[canteenName] = mealsByCounter;
        } else {
            // Only reached if explicitly marked as fallback (else we would have skipped)
            fallbackMealsByCanteen[canteenName] = mealsByCounter;
        }
    }

    return {validMealsByCanteen, fallbackMealsByCanteen};
}

// functions to interact with the filesystem

/**
 * Ensures a local directory exists for the script and returns its path.
 * @returns {string} Full path to the created or existing directory
 */
function createLocalDirectory() {
    const rootDirectory = FILE_MANAGER.documentsDirectory();
    const scriptDirectory = FILE_MANAGER.joinPath(rootDirectory, "canteen");

    if (!FILE_MANAGER.fileExists(scriptDirectory) || !FILE_MANAGER.isDirectory(scriptDirectory)) {
        FILE_MANAGER.createDirectory(scriptDirectory);
    }
    return scriptDirectory;
}

/**
 * Saves the data for the current day into a local json file
 * @param {DateData} dateData The data to be stored
 * @param {Date} date The date as a timestamp to verify if the data is valid later
 * @throws {TypeError} If saveJSON fails to stringify the data
 */
function saveDateData(dateData, date) {
    const jsonData = {date: formatDate(date), plan: dateData};
    saveJSON(MEAL_DATA_PATH, jsonData);
}

/**
 * Loads the data for the current day from the local storage
 * @param {Date} date
 * @returns {DateData|null} The date data if there is any for today else null
 * @throws {SyntaxError} If readJSON fails to read the file
 */
function loadDateData(date) {
    let jsonData;

    try {
        jsonData = readJSON(MEAL_DATA_PATH);
    } catch (error) {
        console.error(error);
        return null;
    }

    if (!jsonData || !isValidJSONData(jsonData)) return null;

    const today = formatDate(date);
    if (jsonData.date !== today) return null;

    return jsonData.plan;
}

/**
 * Performs a simple validation if the data loaded from the json file has the right format
 * @param {any} jsonData
 * @returns {boolean}
 */
function isValidJSONData(jsonData) {
    return (
        jsonData?.plan &&
        typeof jsonData.plan === "object" &&
        Object.keys(jsonData.plan).length > 0 &&
        jsonData?.date &&
        typeof jsonData.date === "string"
    )
}

/**
 * Stores the json data in a file on the local filesystem
 * @param {string} filePath Absolute path for the JSON file
 * @param {Object} jsonData Data to store
 * @throws {TypeError} If the data cannot be stringified
 */
function saveJSON(filePath, jsonData) {
    try {
        const jsonString = JSON.stringify(jsonData, null, 0);
        FILE_MANAGER.writeString(filePath, jsonString);
    } catch (error) {
        throw new TypeError(`saveJSON failed: ${error.message}`)
    }
}

/**
 * Reads and parses the content of a json file in the local filesystem
 * @param {string} filePath Absolute path for the JSON file
 * @returns {Object|null} Parsed JSON object or null if the file does not exist
 * @throws {SyntaxError} If the file content is not valid JSON
 */
function readJSON(filePath) {
    if (!FILE_MANAGER.fileExists(filePath)) {
        console.warn(`readJSON: file does not exist at path "${filePath}". Returning null.`);
        return null;
    }

    try {
        const jsonString = FILE_MANAGER.readString(filePath);
        return JSON.parse(jsonString);
    } catch (error) {
        throw new SyntaxError(`readJSON failed: ${error.message}`);
    }
}

// small helper functions

/**
 * Helper function that returns the text in the specified language for a given key
 * @param {string} key
 */
function getText(key) {
    const language = ACTIVE_CONFIG.language in TRANSLATIONS? ACTIVE_CONFIG.language: "english";
    return TRANSLATIONS[language][key] || `Missing ${key}`;
}

/**
 * Checks if the meal is valid (e.g. it does not contain blacklisted allergens)
 * @param {string} mealName
 * @param {string} mealAllergens
 * @returns {boolean}
 */
function isMealValid(mealName, mealAllergens) {
    // if the user wants to always see the salad bar, we can immediately return true

    if (
        ACTIVE_CONFIG.alwaysShowSaladBar &&
        (mealName.startsWith("Auswahl an angemachten Salaten") || mealName.startsWith("daily salad"))
    ) {
        return true;
    }

    // otherwise we need to check if the meal contains any allergens that the user has blacklisted
    for (const allergen of ACTIVE_CONFIG.userAllergens) {
        if (mealAllergens.includes(allergen)) {
            return false;
        }
    }
    return true;
}

/**
 * Shortens some known long names of meals
 * @param {string} mealName
 * @returns {string}
 */
function shortenMealName(mealName) {
    if (ACTIVE_CONFIG.language === "german") {
        return shortenGermanMealName(mealName);
    }
    return shortenEnglishMealName(mealName);
}

/**
 * Shortens some known long german meal names
 * @param {string} mealName
 * @returns {string}
 */
function shortenGermanMealName(mealName) {
    if (mealName.startsWith("Tagessalat")) {
        mealName = "Tagessalat";
    } else if (mealName.startsWith("Auswahl an angemachten Salaten")) {
        mealName = "Salatbar";
    } else if (mealName.startsWith("Frisch gebrühte Bockwurst")) {
        mealName = "Bockwurst oder Rindswurst mit Senf";
    }
    mealName = mealName.replace("inkl. 1 Portion Ketchup oder Mayonaise", "");
    return mealName.trim();
}

/**
 * Shortens some known long english meal names
 * @param {string} mealName
 * @returns {string}
 */
function shortenEnglishMealName(mealName) {
    if (mealName.startsWith("daily salad")) {
        mealName = "daily salad";
    } else if (mealName.startsWith("Selection of dressed salads")) {
        mealName = "salad bar";
    } else if (mealName.startsWith("hot pork sausage")) {
        mealName = "mustard or beef sausage";
    }
    mealName = mealName.replace("inkl. 1 portion ketchup or mayonaise", "");
    return mealName.trim();
}

/**
 * Adds a bullet point before the name of a meal
 * @param {string} mealName
 * @returns {string}
 */
function addBulletPoint(mealName) {
    return "• " + mealName;
}

/**
 * Generates a description for a meal that contains the name and (if the user specified this) also the price and a bullet
 * point.
 * @param {MealData} meal
 * @returns {string}
 */
function getMealDescription(meal) {
    let mealName = shortenMealName(meal.name[ACTIVE_CONFIG.language]);

    // add a bullet point if specified
    if (ACTIVE_CONFIG.addBulletPoints) {
        mealName = addBulletPoint(mealName);
    }

    if (!ACTIVE_CONFIG.showPrices) {
        return mealName;
    }

    // add the price if specified
    let mealPrice = formatPrice(mealName, meal["prices"][(ACTIVE_CONFIG.useDiscountedPrices ? "discounted" : "normal")])

    // there is a bug in the API due to which the price of this item is sometimes set to 0€
    // the real price is 1,37€ (might change in the future)
    if (mealName.includes("Bockwurst oder Rindswurst mit Senf") && mealPrice === "0,00€") {
        mealPrice = "1,37€"
    } else if (mealName.includes("mustard or beef sausage") && mealPrice === "0,00€") {
        mealPrice = "1,37€"
    }

    return (mealName + " " + mealPrice).trim();
}

/**
 * Checks if the user input is a valid index of the CONFIGS list.
 * @param {any} arg
 * @returns {boolean}
 */
function isValidIndex(arg) {
    if (typeof arg !== 'string') {
        return false;
    }

    const num = Number(arg);
    return Number.isInteger(num) && num >= 0 && num < CONFIGS.length && arg.trim() !== '';
}

/**
 * Formats the given Date into the format DD.MM.YYYY
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

/**
 * Formats the price into xx,yy€
 * @param {string} mealName
 * @param {number} price
 * @returns {string}
 */
function formatPrice(mealName, price) {
    let mealPrice;

    if (mealName.includes("Salatbar") || mealName.includes("salad bar")) {
        // the original data from the API contains the price of 1kg
        mealPrice = `${(price/10).toFixed(2).replace(".", ",")}€`;
        mealPrice += "/100g";
    } else {
        mealPrice = `${price.toFixed(2).replace(".", ",")}€`;
    }

    return mealPrice;
}

/**
 * Returns the current date before "switchToTomorrowTime" else the date of tomorrow
 * @returns {Date}
 */
function getRelevantDate() {
    const now = new Date()

    if (now.getHours() < ACTIVE_CONFIG.switchToTomorrowTime) {
        return now;
    }
    return new Date(now.setDate(now.getDate() + 1));
}

// Functions to create the widget

/**
 * Generates a LinearGradient-Object based on the user's config.
 * @returns {LinearGradient}
 */
function getGradient() {
    const gradient = new LinearGradient();
    gradient.locations = [0, 1];

    const colors = ACTIVE_CONFIG.gradientColors;

    let startColor = Color.white();
    let endColor = Color.white();

    if (colors.length === 1) {
        startColor = endColor = new Color(colors[0]);
    } else if (colors.length >= 2) {
        startColor = new Color(colors[0]);
        endColor = new Color(colors[1]);
    }

    gradient.colors = [startColor, endColor];
    return gradient;
}

/**
 * Styles the widget by setting a URL that is opened when tapping the widget, the padding on the left and the background
 * @param {ListWidget} widget
 */
function setWidgetStyling(widget) {
    if (ACTIVE_CONFIG.openURL !== "") {
        widget.url = ACTIVE_CONFIG.openURL;
    }
    widget.setPadding(0, 20, 0, 0);
    widget.backgroundGradient = getGradient();
}

/**
 * Displays a message on the widget if no meals were found for today
 * @param {ListWidget} widget
 * @param {Date} date
 */
function setNoMenuMessage(widget, date) {
    const today = new Date();
    const text = date.getDate() === today.getDate() ? getText("noMenuToday") : getText("noMenuTomorrow")
    let message = widget.addText(text);
    message.font = Font.systemFont(14);
    message.textColor = COLORS.textColor;
}

/**
 * Adds a subtitle containing the given canteen name
 * @param {ListWidget} widget
 * @param {string} canteen
 */
function setCanteenName(widget, canteen) {
    let canteenText = widget.addText(canteen);
    canteenText.font = Font.boldSystemFont(14);
    canteenText.textColor = COLORS.headerColor;
}

/**
 * Adds a subtitle containing the given counter name
 * @param {ListWidget} widget
 * @param {string} counter
 */
function setCounterName(widget, counter) {
    let counterText = widget.addText(counter);
    counterText.font = Font.boldSystemFont(12);
    counterText.textColor = COLORS.textColor;
}

/**
 * Adds a new meal based on the given description
 * @param {ListWidget} widget
 * @param {string} mealDescription
 */
function addMeal(widget, mealDescription) {
    let mealText = widget.addText(mealDescription);
    mealText.font = Font.systemFont(12);
    mealText.textColor = COLORS.textColor;
    widget.addSpacer(1);
}

/**
 * Adds the title to the widget which contains the date which is used
 * @param {ListWidget} widget
 * @param {Date} date
 */
function addDate(widget, date) {
    const text = `${getText("title")} (${formatDate(date)})`;
    let dateText = widget.addText(text);
    dateText.font = Font.systemFont(12);
    dateText.textColor = COLORS.textColor;
    widget.addSpacer(2);
}

/**
 * Adds a list of all currently active allergen filters to the widget
 * @param {ListWidget} widget
 */
function addAllergens(widget) {
    if (ACTIVE_CONFIG.userAllergens.length === 0) {
        return;
    }

    // first get the description
    let allergenText = `${getText("allergenMessage")}\n`;

    for (const allergen of ACTIVE_CONFIG.userAllergens) {
        allergenText += `${ACTIVE_CONFIG.language === "german" ? FULL_ALLERGEN_NAMES[allergen][0]: FULL_ALLERGEN_NAMES[allergen][1]}, `;
    }
    allergenText = allergenText.slice(0, -2);  // remove last comma

    // then add the description to the widget
    let allergenDescription = widget.addText(allergenText);
    allergenDescription.font = Font.italicSystemFont(10);
    allergenDescription.textColor = COLORS.textColor;
    widget.addSpacer(1);
}

/**
 * Displays an error message on the widget if something went wrong (e.g. there is no internet connection)
 * @param {ListWidget} widget
 */
function setErrorMessage(widget) {
    let errorText = widget.addText(getText("errorMessage"));
    errorText.font = Font.systemFont(14);
    errorText.textColor = COLORS.errorColor;
}

/**
 * Creates the widget based on the data from the API
 * @param {CanteenCounterItems} allMeals
 * @param {Date} date
 */
function createWidget(allMeals, date) {
    const widget = new ListWidget();
    setWidgetStyling(widget);

    // first check if there is any data
    if (Object.keys(allMeals).length === 0) {
        setNoMenuMessage(widget, date);
        Script.setWidget(widget);
        return;
    }

    // otherwise fill the widget with the data
    addDate(widget, date);
    addAllergens(widget);

    for (const canteenName of Object.keys(allMeals)) {

        const canteenData = allMeals[canteenName];

        // skip canteens if no data is available
        if (!canteenData || Object.keys(canteenData).length === 0) continue;

        setCanteenName(widget, canteenName);

        // add the counters and meals corresponding to them
        for (const counterName in canteenData) {
            setCounterName(widget, counterName);

            for (const mealDescription of canteenData[counterName]) {
                addMeal(widget, mealDescription);
            }
        }
        widget.addSpacer(4);
    }
    Script.setWidget(widget);
}

/**
 * Creates a generic error widget
 */
function createErrorWidget() {
    const widget = new ListWidget();
    setWidgetStyling(widget);
    setErrorMessage(widget);
    Script.setWidget(widget);
}

/**
 * Entry point: fetches menu data (online or fallback) and renders the widget.
 * If both sources fail, shows an error widget.
 */
async function main() {
    if (!config.runsInWidget) return;

    const date = getRelevantDate();
    const currentMenu = await getMenuData(date);

    try {
        saveDateData(currentMenu, date);
    } catch (error) {
        console.error(error);
    }

    if (currentMenu) {
        const allMeals = extractAllMeals(currentMenu);
        createWidget(allMeals, date);
    } else {
        console.warn("No menu data available: both fetch and local fallback failed.");
        createErrorWidget();
    }
}
