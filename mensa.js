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
 * @typedef {{[key: string]: CounterData}} CanteenData
 */

/**
 * @typedef {{[key: string]: CanteenData}} DateData
 */

/**
 * @typedef {{[key: string]: DateData}} PlanData
 */

/**
 * @typedef {{status: string, plan: PlanData}} RawJSONData
 */

// -----------------------------------------------------------------

// you can add custom configs to the list and select your config via the widget parameter (the parameter should be the index)
// do not delete the default config

const CONFIGS = Object.freeze([
    {
        activeCanteens: ["Zentralmensa"],
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

let widget;
const date = getDate();
const COLORS = {
    headerColor: new Color(ACTIVE_CONFIG.headerColor),
    textColor: new Color(ACTIVE_CONFIG.textColor),
    errorColor: new Color(ACTIVE_CONFIG.errorColor)
}
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
})

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
 * @returns {Promise<DateData>}
 * @throws Throws an error if fetchCanteenData failed to fetch the data
 */
async function fetchAllMeals(date) {
    const data = await fetchCanteenData();

    if (!data) {
        throw new Error(getText("errorMessage"));
    }

    const allMeals = data["plan"][formatDate(date)];

    // the type is undefined if there is no data for today (data["plan"][format(date)] does not exist then)
    // if so, return an empty object to make clear that there is no data
    return allMeals ?? {};
}

/**
 * Creates an object that contains the data for all meals at one canteen.
 * The return object has keys for the specified counters and stores lists with all meals (meals as strings)
 * @param {CanteenData} canteenData
 * @returns {{[key: string]: string[]}}
*/
function extractCanteenItems(canteenData) {
    let canteenMeals = {};

    const counterNames = Object.keys(canteenData).sort();

    for (const counterName of counterNames) {

        // ignore side dishes if specified
        if (counterName === "Beilagen" && !ACTIVE_CONFIG.showSideDishes) {
            continue;
        }

        const counterMeals = canteenData[counterName];

        for (const meal of counterMeals) {

            // don't add meals which include allergens that the user blacklists
            if (!isMealValid(meal["name"][ACTIVE_CONFIG.language], meal["allergens"])) {
                continue;
            }

            if (canteenMeals[counterName]) {
                canteenMeals[counterName].push(getMealDescription(meal));
            } else {
                canteenMeals[counterName] = [getMealDescription(meal)];
            }
        }
    }
    return canteenMeals;
}

/**
 * Extracts all meals from the specified day
 * @param {DateData} currentMenu
 * @returns {{[key: string]: {[key: string]: string}}}
 */
function extractAllMeals(currentMenu) {
    let allMeals = {};

    for (const canteenName of ACTIVE_CONFIG.activeCanteens) {
        const canteenData = currentMenu[canteenName];

        // test if there is any data for today in this canteen
        if (canteenData) {
            allMeals[canteenName] = extractCanteenItems(canteenData);
        }
    }
    return allMeals;
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
    if (mealName.startsWith("Auswahl an angemachten Salaten") && ACTIVE_CONFIG.alwaysShowSaladBar) {
        return true;
    } else if (mealName.startsWith("daily salad") && ACTIVE_CONFIG.alwaysShowSaladBar) {
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
    return mealName.trim() + " ";
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
    return mealName.trim() + " ";
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
    let mealName = shortenMealName(meal["name"][ACTIVE_CONFIG.language]);

    // add a bullet point if specified
    if (ACTIVE_CONFIG.addBulletPoints) {
        mealName = addBulletPoint(mealName);
    }

    let mealPrice = "";

    // add the price if specified
    if (ACTIVE_CONFIG.showPrices) {
        mealPrice = formatPrice(meal["prices"][(ACTIVE_CONFIG.useDiscountedPrices ? "discounted" : "normal")])

        // there is a bug in the API due to which the price of this item is sometimes set to 0€
        // the real price is 1,37€ (might change in the future)
        if (mealName.includes("Bockwurst oder Rindswurst mit Senf") && mealPrice === "0,00€") {
            mealPrice = "1,37€"
        } else if (mealName.includes("mustard or beef sausage") && mealPrice === "0,00€") {
            mealPrice = "1,37€"
        } else if (mealName.includes("Salatbar") || mealName === "salad bar") {
            mealPrice += "/kg"
        }
    }
    return (mealName + mealPrice).trim();
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
 * @param {number} price
 * @returns {string}
 */
function formatPrice(price) {
    return `${price.toFixed(2).replace(".", ",")}€`;
}

/**
 * Returns the current date before "switchToTomorrowTime" else the date of tomorrow
 * @returns {Date}
 */
function getDate() {
    const today = new Date()

    if (today.getHours() < ACTIVE_CONFIG.switchToTomorrowTime) {
        return today;
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow;
}

// Functions to create the widget

/**
 * Generates a LinearGradient-Object based on the user's config.
 * @returns {LinearGradient}
 */
function getGradient() {
    let gradient = new LinearGradient();
    gradient.locations = [0, 1];

    if (ACTIVE_CONFIG.gradientColors.length === 0) {
        // use white as a default color if the user hasn't specified one
        gradient.colors = [Color.white(), Color.white()];
    } else if (ACTIVE_CONFIG.gradientColors.length === 1) {
        // if the user chooses only one color, this will be the background color
        gradient.colors = [new Color(ACTIVE_CONFIG.gradientColors[0]), new Color(ACTIVE_CONFIG.gradientColors[0])];
    } else {
        // if the user chooses at least two colors, the first two are used for the gradient
        gradient.colors = [new Color(ACTIVE_CONFIG.gradientColors[0]), new Color(ACTIVE_CONFIG.gradientColors[1])];
    }
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
 * @param {{[key: string]: {[key: string]: string}}} allMeals
 * @param {Date} date
 * @returns {ListWidget}
 */
function createWidget(allMeals, date) {
    widget = new ListWidget();
    setWidgetStyling(widget);

    // first check if there is any data
    if (Object.keys(allMeals).length === 0) {
        setNoMenuMessage(widget, date);
    } else {

        addDate(widget, date);
        addAllergens(widget);

        for (const canteenName of ACTIVE_CONFIG.activeCanteens) {

            let canteenData = allMeals[canteenName];

            if (!canteenData) {
                continue;
            }

            setCanteenName(widget, canteenName);

            for (const counterName in canteenData) {
                setCounterName(widget, counterName);

                for (const mealDescription of canteenData[counterName]) {
                    addMeal(widget, mealDescription);
                }
            }
            widget.addSpacer(4);
        }
    }
    return widget;
}

/**
 * Fetches the data from the API and creates the widget based on the data
 * @returns {Promise<void>}
 */
async function main() {
    if (config.runsInWidget) {

        // there can occur errors while trying to fetch the data
        try {
            const currentMenu = await fetchAllMeals(date);
            const allMeals = extractAllMeals(currentMenu);
            widget = createWidget(allMeals, date);
        } catch (error) {
            widget = new ListWidget();
            setWidgetStyling(widget);
            setErrorMessage(widget);
        }

        Script.setWidget(widget);
    }
}
