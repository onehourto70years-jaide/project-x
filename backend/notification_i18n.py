"""NutriOS Push Notification Translations.

Multilingual notification content for all supported languages.
Keys match the frontend i18n locale codes: en, it, es, fr.
"""

NOTIFICATION_STRINGS = {
    "en": {
        # Water reminders
        "water_title": "💧 Stay Hydrated!",
        "water_body": "Time to drink water. Your body needs it for optimal nutrient absorption!",
        "water_smart_title": "💧 Water Reminder",
        "water_smart_body_none": "You haven't logged any water today. Stay hydrated!",
        "water_smart_body_low": "You've only had {amount}ml today — that's {pct}% of your goal. Keep drinking!",
        "water_smart_body_almost": "Almost there! Just {remaining}ml more to hit your water goal today!",
        "water_goal_hit_title": "🎉 Hydration Goal Hit!",
        "water_goal_hit_body": "You've reached your daily water goal of {goal}ml! Great job staying hydrated!",

        # Meal reminders
        "meal_breakfast_title": "🍳 Breakfast Time",
        "meal_breakfast_body": "Start your day with a nutrient-rich breakfast!",
        "meal_lunch_title": "🥗 Lunch Time",
        "meal_lunch_body": "Don't forget to log your lunch for accurate tracking!",
        "meal_dinner_title": "🍽️ Dinner Time",
        "meal_dinner_body": "Plan a balanced dinner to hit your daily goals!",
        "meal_smart_title": "📊 Daily Intake Check",
        "meal_smart_body": "You've had {calories} kcal today ({pct}% of your goal). {msg}",
        "meal_smart_low": "Consider a nutrient-dense snack!",
        "meal_smart_good": "Keep it up!",
        "meal_smart_over": "You're a bit over — choose lighter options.",

        # Routine reminders
        "routine_morning_title": "🌅 Morning Routine",
        "routine_morning_body": "Time to start your morning routine!",
        "routine_evening_title": "🌙 Evening Routine",
        "routine_evening_body": "Wind down with your evening routine.",
        "routine_smart_title": "✅ Routine Check",
        "routine_smart_body": "You have {pending} uncompleted tasks today. Tap to check them off!",

        # Streak notifications
        "streak_risk_title": "🔥 Streak at Risk!",
        "streak_risk_body": "Your {days}-day streak is about to break! Log a meal to keep it alive.",
        "streak_milestone_title": "🏆 Streak Milestone!",
        "streak_milestone_body": "Amazing! You've maintained a {days}-day logging streak!",

        # Inactivity
        "inactivity_title": "👋 We Miss You!",
        "inactivity_body": "It's been {days} days since you last logged. Your NutriOS goals are waiting!",

        # Daily summary
        "summary_title": "📊 Daily Summary Ready",
        "summary_body": "You logged {meals} meal(s) today. Check your elemental report!",

        # Badge earned
        "badge_title": "🏆 New Badge Earned!",
        "badge_body": "Congratulations! You've earned the '{name}' badge!",

        # Test
        "test_title": "🧬 NutriOS Test",
        "test_body": "Push notifications are working! You'll receive smart reminders.",
    },
    "it": {
        "water_title": "💧 Resta Idratato!",
        "water_body": "È ora di bere acqua. Il tuo corpo ne ha bisogno per un assorbimento ottimale dei nutrienti!",
        "water_smart_title": "💧 Promemoria Acqua",
        "water_smart_body_none": "Non hai ancora registrato acqua oggi. Resta idratato!",
        "water_smart_body_low": "Hai bevuto solo {amount}ml oggi — il {pct}% del tuo obiettivo. Continua a bere!",
        "water_smart_body_almost": "Quasi fatto! Solo {remaining}ml in più per raggiungere il tuo obiettivo!",
        "water_goal_hit_title": "🎉 Obiettivo Idratazione Raggiunto!",
        "water_goal_hit_body": "Hai raggiunto il tuo obiettivo giornaliero di {goal}ml! Ottimo lavoro!",

        "meal_breakfast_title": "🍳 Ora di Colazione",
        "meal_breakfast_body": "Inizia la giornata con una colazione ricca di nutrienti!",
        "meal_lunch_title": "🥗 Ora di Pranzo",
        "meal_lunch_body": "Non dimenticare di registrare il pranzo per un monitoraggio accurato!",
        "meal_dinner_title": "🍽️ Ora di Cena",
        "meal_dinner_body": "Pianifica una cena equilibrata per raggiungere i tuoi obiettivi!",
        "meal_smart_title": "📊 Controllo Assunzione",
        "meal_smart_body": "Hai assunto {calories} kcal oggi ({pct}% del tuo obiettivo). {msg}",
        "meal_smart_low": "Considera uno spuntino ricco di nutrienti!",
        "meal_smart_good": "Continua così!",
        "meal_smart_over": "Sei un po' sopra — scegli opzioni più leggere.",

        "routine_morning_title": "🌅 Routine Mattutina",
        "routine_morning_body": "È ora di iniziare la tua routine mattutina!",
        "routine_evening_title": "🌙 Routine Serale",
        "routine_evening_body": "Rilassati con la tua routine serale.",
        "routine_smart_title": "✅ Controllo Routine",
        "routine_smart_body": "Hai {pending} attività incomplete oggi. Tocca per completarle!",

        "streak_risk_title": "🔥 Serie a Rischio!",
        "streak_risk_body": "La tua serie di {days} giorni sta per interrompersi! Registra un pasto!",
        "streak_milestone_title": "🏆 Traguardo Serie!",
        "streak_milestone_body": "Incredibile! Hai mantenuto una serie di {days} giorni!",

        "inactivity_title": "👋 Ci Manchi!",
        "inactivity_body": "Sono passati {days} giorni dall'ultima registrazione. I tuoi obiettivi ti aspettano!",

        "summary_title": "📊 Riepilogo Giornaliero",
        "summary_body": "Hai registrato {meals} pasto/i oggi. Controlla il tuo rapporto!",

        "badge_title": "🏆 Nuovo Badge Ottenuto!",
        "badge_body": "Congratulazioni! Hai ottenuto il badge '{name}'!",

        "test_title": "🧬 Test NutriOS",
        "test_body": "Le notifiche push funzionano! Riceverai promemoria intelligenti.",
    },
    "es": {
        "water_title": "💧 ¡Mantente Hidratado!",
        "water_body": "Es hora de beber agua. ¡Tu cuerpo la necesita para una absorción óptima de nutrientes!",
        "water_smart_title": "💧 Recordatorio de Agua",
        "water_smart_body_none": "No has registrado agua hoy. ¡Mantente hidratado!",
        "water_smart_body_low": "Solo has tomado {amount}ml hoy — es el {pct}% de tu meta. ¡Sigue bebiendo!",
        "water_smart_body_almost": "¡Casi! Solo {remaining}ml más para alcanzar tu meta de agua.",
        "water_goal_hit_title": "🎉 ¡Meta de Hidratación Lograda!",
        "water_goal_hit_body": "¡Has alcanzado tu meta diaria de {goal}ml! ¡Excelente trabajo!",

        "meal_breakfast_title": "🍳 Hora del Desayuno",
        "meal_breakfast_body": "¡Comienza el día con un desayuno rico en nutrientes!",
        "meal_lunch_title": "🥗 Hora del Almuerzo",
        "meal_lunch_body": "¡No olvides registrar tu almuerzo para un seguimiento preciso!",
        "meal_dinner_title": "🍽️ Hora de la Cena",
        "meal_dinner_body": "¡Planifica una cena equilibrada para alcanzar tus metas!",
        "meal_smart_title": "📊 Control de Ingesta",
        "meal_smart_body": "Has consumido {calories} kcal hoy ({pct}% de tu meta). {msg}",
        "meal_smart_low": "¡Considera un snack nutritivo!",
        "meal_smart_good": "¡Sigue así!",
        "meal_smart_over": "Estás un poco por encima — elige opciones más ligeras.",

        "routine_morning_title": "🌅 Rutina Matutina",
        "routine_morning_body": "¡Es hora de comenzar tu rutina matutina!",
        "routine_evening_title": "🌙 Rutina Nocturna",
        "routine_evening_body": "Relájate con tu rutina nocturna.",
        "routine_smart_title": "✅ Control de Rutina",
        "routine_smart_body": "Tienes {pending} tareas pendientes hoy. ¡Toca para completarlas!",

        "streak_risk_title": "🔥 ¡Racha en Riesgo!",
        "streak_risk_body": "¡Tu racha de {days} días está por romperse! Registra una comida.",
        "streak_milestone_title": "🏆 ¡Hito de Racha!",
        "streak_milestone_body": "¡Increíble! ¡Has mantenido una racha de {days} días!",

        "inactivity_title": "👋 ¡Te Extrañamos!",
        "inactivity_body": "Han pasado {days} días desde tu último registro. ¡Tus metas te esperan!",

        "summary_title": "📊 Resumen Diario Listo",
        "summary_body": "Registraste {meals} comida(s) hoy. ¡Revisa tu informe!",

        "badge_title": "🏆 ¡Nuevo Logro!",
        "badge_body": "¡Felicidades! ¡Has obtenido el logro '{name}'!",

        "test_title": "🧬 Prueba NutriOS",
        "test_body": "¡Las notificaciones push funcionan! Recibirás recordatorios inteligentes.",
    },
    "fr": {
        "water_title": "💧 Restez Hydraté !",
        "water_body": "Il est temps de boire de l'eau. Votre corps en a besoin pour une absorption optimale !",
        "water_smart_title": "💧 Rappel Hydratation",
        "water_smart_body_none": "Vous n'avez pas encore bu d'eau aujourd'hui. Restez hydraté !",
        "water_smart_body_low": "Vous n'avez bu que {amount}ml aujourd'hui — soit {pct}% de votre objectif. Continuez !",
        "water_smart_body_almost": "Presque ! Plus que {remaining}ml pour atteindre votre objectif !",
        "water_goal_hit_title": "🎉 Objectif Hydratation Atteint !",
        "water_goal_hit_body": "Vous avez atteint votre objectif de {goal}ml ! Excellent travail !",

        "meal_breakfast_title": "🍳 Heure du Petit-Déjeuner",
        "meal_breakfast_body": "Commencez la journée avec un petit-déjeuner nutritif !",
        "meal_lunch_title": "🥗 Heure du Déjeuner",
        "meal_lunch_body": "N'oubliez pas de noter votre déjeuner pour un suivi précis !",
        "meal_dinner_title": "🍽️ Heure du Dîner",
        "meal_dinner_body": "Planifiez un dîner équilibré pour atteindre vos objectifs !",
        "meal_smart_title": "📊 Bilan Nutritionnel",
        "meal_smart_body": "Vous avez consommé {calories} kcal aujourd'hui ({pct}% de votre objectif). {msg}",
        "meal_smart_low": "Pensez à un en-cas nutritif !",
        "meal_smart_good": "Continuez comme ça !",
        "meal_smart_over": "Vous dépassez un peu — optez pour des choix plus légers.",

        "routine_morning_title": "🌅 Routine Matinale",
        "routine_morning_body": "C'est l'heure de votre routine du matin !",
        "routine_evening_title": "🌙 Routine du Soir",
        "routine_evening_body": "Détendez-vous avec votre routine du soir.",
        "routine_smart_title": "✅ Suivi Routine",
        "routine_smart_body": "Vous avez {pending} tâches en attente. Appuyez pour les compléter !",

        "streak_risk_title": "🔥 Série en Danger !",
        "streak_risk_body": "Votre série de {days} jours va s'arrêter ! Enregistrez un repas !",
        "streak_milestone_title": "🏆 Jalon de Série !",
        "streak_milestone_body": "Incroyable ! Vous maintenez une série de {days} jours !",

        "inactivity_title": "👋 Vous Nous Manquez !",
        "inactivity_body": "Cela fait {days} jours depuis votre dernière activité. Vos objectifs vous attendent !",

        "summary_title": "📊 Résumé Quotidien",
        "summary_body": "Vous avez enregistré {meals} repas aujourd'hui. Consultez votre rapport !",

        "badge_title": "🏆 Nouveau Badge !",
        "badge_body": "Félicitations ! Vous avez obtenu le badge '{name}' !",

        "test_title": "🧬 Test NutriOS",
        "test_body": "Les notifications push fonctionnent ! Vous recevrez des rappels intelligents.",
    },
}


def get_notif_string(lang: str, key: str, **kwargs) -> str:
    """Get a translated notification string, with fallback to English."""
    strings = NOTIFICATION_STRINGS.get(lang, NOTIFICATION_STRINGS["en"])
    template = strings.get(key, NOTIFICATION_STRINGS["en"].get(key, key))
    try:
        return template.format(**kwargs) if kwargs else template
    except (KeyError, IndexError):
        return template
