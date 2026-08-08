/* SliceFx site behavior: language toggle and copy button. Nothing else.
   The page renders complete and readable with this file blocked. */

(function () {
    'use strict';

    var STORAGE_KEY = 'slice-docs-language';
    var SUPPORTED = ['en', 'ja'];
    var langSelect = document.getElementById('langSelect');
    var copyButton = document.getElementById('copyCommandButton');
    var copyCommand = document.getElementById('copyCommand');
    var copyStatus = document.getElementById('copyStatus');
    var statusTimeout;

    function readSavedLanguage() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return null;
        }
    }

    function saveLanguage(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (error) {
            /* private browsing — the toggle still works for this page view */
        }
    }

    function currentLanguage() {
        var lang = document.body.getAttribute('data-lang');
        return SUPPORTED.indexOf(lang) === -1 ? 'en' : lang;
    }

    function setLanguage(lang, persist) {
        var next = SUPPORTED.indexOf(lang) === -1 ? 'en' : lang;
        document.body.setAttribute('data-lang', next);
        document.documentElement.lang = next;
        if (langSelect && langSelect.value !== next) {
            langSelect.value = next;
        }
        if (persist) {
            saveLanguage(next);
        }
    }

    function setStatus(message, isError) {
        if (!copyStatus) {
            return;
        }
        window.clearTimeout(statusTimeout);
        copyStatus.textContent = message;
        copyStatus.classList.toggle('is-error', !!isError);
        copyStatus.classList.toggle('is-ok', !isError);
        statusTimeout = window.setTimeout(function () {
            copyStatus.textContent = '';
        }, 3000);
    }

    function legacyCopy(text) {
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        try {
            return document.execCommand('copy')
                ? Promise.resolve()
                : Promise.reject(new Error('Copy command was not accepted.'));
        } finally {
            area.remove();
        }
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).catch(function () {
                return legacyCopy(text);
            });
        }
        return legacyCopy(text);
    }

    function onCopy() {
        var text = copyCommand ? copyCommand.textContent.trim() : '';
        copyText(text).then(function () {
            setStatus(currentLanguage() === 'ja' ? 'コピーしました。' : 'Copied.', false);
        }).catch(function () {
            setStatus(
                currentLanguage() === 'ja'
                    ? 'コピーできませんでした。手動でコピーしてください: ' + text
                    : 'Could not copy automatically. Please copy manually: ' + text,
                true
            );
        });
    }

    setLanguage(readSavedLanguage() || 'en', false);

    if (langSelect) {
        langSelect.addEventListener('change', function (event) {
            setLanguage(event.target.value, true);
        });
    }
    if (copyButton) {
        copyButton.addEventListener('click', onCopy);
    }
}());
