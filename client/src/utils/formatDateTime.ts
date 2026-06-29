

export const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const get = (type: string) =>
        parts.find((part) => part.type === type)?.value;

    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
};