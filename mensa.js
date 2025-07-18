// -----------------------------------------------------------------

// you can add custom configs to the list and select your config via the widget parameter (the parameter should be the index)
// do not delete the default config

const CONFIGS = [
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
]

// -----------------------------------------------------------------

// Functions to analyze the data

async function fetchCanteen(date) {
    try {
        const request = new Request("https://ves.uni-mainz.de/services/python/spaiseplan/plan");
        request.method = "GET";

        const data = await request.loadJSON();
        return data["plan"][formatDate(date)];

    } catch (error) {
        throw new Error(ACTIVE_CONFIG.language === "german" ? "Mensa-Daten konnten nicht geladen werden." : "Could not load canteen-data.");
    }
}

function extractCanteenItems(canteenData) {
    let meals = {};

    let counterNames = Object.keys(canteenData);
    counterNames.sort();

    for (const counterName of counterNames) {

        // ignore side dishes
        if (counterName === "Beilagen" && !ACTIVE_CONFIG.showSideDishes) {
            continue;
        }

        const counterMeals = canteenData[counterName];

        for (const meal of counterMeals) {

            if (!isMealValid(meal["name"][ACTIVE_CONFIG.language], meal["allergens"])) {
                continue;
            }

            if (meals[counterName]) {
                meals[counterName].push(getMealDescription(meal));
            } else {
                meals[counterName] = [getMealDescription(meal)];
            }
        }
    }
    return meals;
}

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

function isMealValid(mealName, mealAllergens) {
    if (mealName.startsWith("Auswahl an angemachten Salaten") && ACTIVE_CONFIG.alwaysShowSaladBar) {
        return true;
    } else if (mealName.startsWith("daily salad") && ACTIVE_CONFIG.alwaysShowSaladBar) {
        return true;
    }

    for (const allergen of ACTIVE_CONFIG.userAllergens) {
        if (mealAllergens.includes(allergen)) {
            return false;
        }
    }
    return true;
}

function shortenMealName(mealName) {
    if (ACTIVE_CONFIG.language === "german") {
        return shortenGermanMealName(mealName);
    }
    return shortenEnglishMealName(mealName);
}

function shortenGermanMealName(mealName) {
    if (mealName.startsWith("Tagessalat")) {
        mealName = "Tagessalat";
    } else if (mealName.startsWith("Auswahl an angemachten Salaten")) {
        mealName = "Salatbar";
    } else if (mealName.startsWith("Frisch gebrühte Bockwurst")) {
        mealName = "Bockwurst oder Rindswurst mit Senf"
    }
    mealName = mealName.replace("inkl. 1 Portion Ketchup oder Mayonaise", "");
    return (ACTIVE_CONFIG.addBulletPoints ? "• " : "") + mealName.trim() + " "
}

function shortenEnglishMealName(mealName) {
    if (mealName.startsWith("daily salad")) {
        mealName = "daily salad";
    } else if (mealName.startsWith("Selection of dressed salads")) {
        mealName = "salad bar";
    } else if (mealName.startsWith("hot pork sausage")) {
        mealName = "mustard or beef sausage"
    }
    mealName = mealName.replace("inkl. 1 portion ketchup or mayonaise", "");
    return (ACTIVE_CONFIG.addBulletPoints ? "• " : "") + mealName.trim() + " "
}

function getMealDescription(meal) {
    const mealName = shortenMealName(meal["name"][ACTIVE_CONFIG.language]);
    let mealPrice = "";

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
    return (mealName + " " + mealPrice).trim();
}

function isValidIndex(arg) {
    if (typeof arg !== 'string') {
        return false;
    }

    const num = Number(arg);
    return Number.isInteger(num) && num >= 0 && num < CONFIGS.length && arg.trim() !== '';
}

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

function formatPrice(price) {
    return `${price.toFixed(2).replace(".", ",")}€`;
}

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

function getGradient() {
    let gradient = new LinearGradient();
    gradient.locations = [0, 1];

    if (ACTIVE_CONFIG.gradientColors.length === 0) {
        gradient.colors = [Color.white(), Color.white()];
    } else if (ACTIVE_CONFIG.gradientColors.length === 1) {
        gradient.colors = [new Color(ACTIVE_CONFIG.gradientColors[0]), new Color(ACTIVE_CONFIG.gradientColors[0])];
    } else {
        gradient.colors = [new Color(ACTIVE_CONFIG.gradientColors[0]), new Color(ACTIVE_CONFIG.gradientColors[1])];
    }
    return gradient;
}

function setWidgetStyling(widget) {
    if (ACTIVE_CONFIG.openURL !== "") {
        widget.url = ACTIVE_CONFIG.openURL;
    }
    widget.setPadding(0, 20, 0, 0);
    widget.backgroundGradient = getGradient();
}

function setNoMenuMessage(widget) {
    let message = widget.addText(ACTIVE_CONFIG.language === "german" ? "Für heute ist kein Menü verfügbar." : "There is no menu available for today");
    message.font = Font.systemFont(14);
    message.textColor = COLORS.textColor;
}

function setCanteenName(widget, canteen) {
    let canteenText = widget.addText(canteen);
    canteenText.font = Font.boldSystemFont(14);
    canteenText.textColor = COLORS.headerColor;
}

function setCounterName(widget, counter) {
    let counterText = widget.addText(counter);
    counterText.font = Font.boldSystemFont(12);
    counterText.textColor = COLORS.textColor;
}

function addMeal(widget, mealDescription) {
    let mealText = widget.addText(mealDescription);
    mealText.font = Font.systemFont(12);
    mealText.textColor = COLORS.textColor;
    widget.addSpacer(1);
}

function addDate(widget, date) {
    const text = `${ACTIVE_CONFIG.language === "german" ? "Speiseplan": "Menu"} (${formatDate(date)})`;
    let dateText = widget.addText(text);
    dateText.font = Font.systemFont(12);
    dateText.textColor = COLORS.textColor;
    widget.addSpacer(2);
}

function addAllergens(widget) {
    if (ACTIVE_CONFIG.userAllergens.length === 0) {
        return;
    }

    let allergenText = `${ACTIVE_CONFIG.language === "german" ? "Folgende Allergenfilter sind aktiviert:" : "Currently active allergen filters:"}\n`;

    for (const allergen of ACTIVE_CONFIG.userAllergens) {
        allergenText += `${ACTIVE_CONFIG.language === "german" ? FULL_ALLERGEN_NAMES[allergen][0]: FULL_ALLERGEN_NAMES[allergen][1]}, `;
    }
    allergenText = allergenText.slice(0, -2);  // remove last comma

    let allergenDescription = widget.addText(allergenText);
    allergenDescription.font = Font.italicSystemFont(10);
    allergenDescription.textColor = COLORS.textColor;
    widget.addSpacer(1);
}

function setErrorMessage(widget) {
    let errorText = widget.addText(ACTIVE_CONFIG.language === "german"? "Mensa-Daten konnten nicht geladen werden." : "Could not load canteen-data.");
    errorText.font = Font.systemFont(14);
    errorText.textColor = COLORS.errorColor;
}

function createWidget(allMeals, date) {
    widget = new ListWidget();
    setWidgetStyling(widget);

    // first check if there is any data
    if (Object.keys(allMeals).length === 0) {
        setNoMenuMessage(widget);
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

// -----------------------------------------------------------------

const ARGS = args.widgetParameter;
let CONFIG_INDEX = isValidIndex(ARGS) ? Number(ARGS) : 0;
const ACTIVE_CONFIG = CONFIGS[CONFIG_INDEX];
const FULL_ALLERGEN_NAMES = {
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
};

let widget;
const date = getDate();
const COLORS = {
    headerColor: new Color(ACTIVE_CONFIG.headerColor),
    textColor: new Color(ACTIVE_CONFIG.textColor),
    errorColor: new Color(ACTIVE_CONFIG.errorColor)
}

if (config.runsInWidget) {

    // there can occur errors while trying to fetch the data
    try {
        const currentMenu = await fetchCanteen(date);
        const allMeals = extractAllMeals(currentMenu);
        widget = createWidget(allMeals, date);
    } catch (error) {
        widget = new ListWidget();
        setWidgetStyling(widget);
        setErrorMessage(widget);
    }
    Script.setWidget(widget);
}
Script.complete();
