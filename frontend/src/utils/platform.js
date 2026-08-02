export const checkPlatform = () => {
    if (typeof window === 'undefined')
        return false;
    const searchParams = new URLSearchParams(window.location.search);
    const isAppParam = searchParams.get('platform') === 'app';
    if (isAppParam) {
        localStorage.setItem('isApp', 'true');
        return true;
    }
    return localStorage.getItem('isApp') === 'true';
};
export const isApp = () => {
    return checkPlatform();
};
