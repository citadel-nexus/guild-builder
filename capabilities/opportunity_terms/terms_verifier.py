# CGRF: SRS=TAV-ENG-BUILD-016 | CAPS=B | Seat=gm-builder-warden
#!/usr/bin/env python3
"""opportunity_terms_verifier — Detect opportunity terms in a given text

Inputs: {'text': {'meaning': 'The opportunity listing text to be analyzed for entry fees and rights language', 'type': 'str'}}

Outputs: {'result': {'meaning': 'A dictionary containing the detected entry fee and rights language information', 'type': 'dict'}}

Preconditions: {'text_is_not_empty': 'The input text must not be empty', 'text_is_string': 'The input text must be a string'}

Postconditions: {'result_has_entry_fee_and_rights': "The output result must contain 'entry_fee' and 'rights' keys", 'result_is_dict': 'The output result must be a dictionary'}

Complexity: O(n)

Edge cases: ['The input text contains no entry fee information', 'The input text contains no rights language information', 'The input text contains both entry fee and rights language information', 'The input text is empty', 'The input text is not a string']

Design: The module uses regular expressions to detect entry fees and rights language in the given text. The selftest function checks the module with several examples.
"""

def detect_terms(text):
    result = {'entry_fee': {'found': False, 'amount': None, 'currency': None, 'quote': None}, 'rights': {'transfer': 'unknown', 'quote': None}}
    # Detect entry fees
    import re
    fee_match = re.search(r'\\$(\\d+(?:\\.\\d+)?) (?:entry|application|submission) fee', text)
    if fee_match:
        result['entry_fee']['found'] = True
        result['entry_fee']['amount'] = float(fee_match.group(1))
        result['entry_fee']['currency'] = 'USD'
        result['entry_fee']['quote'] = fee_match.group(0)
    elif re.search(r'no (?:entry|application|submission) fee', text):
        result['entry_fee']['found'] = False
    # Detect rights language
    if re.search(r'grants a non-exclusive license', text):
        result['rights']['transfer'] = 'license'
        result['rights']['quote'] = 'grants a non-exclusive license'
    elif re.search(r'assigns all rights|becomes the property of', text):
        result['rights']['transfer'] = 'assignment'
        result['rights']['quote'] = re.search(r'assigns all rights|becomes the property of', text).group(0)
    elif re.search(r'retain all rights', text):
        result['rights']['transfer'] = 'none'
        result['rights']['quote'] = 'retain all rights'
    return result
def selftest():
    assert detect_terms('$75 entry fee')['entry_fee']['found'] is True
    assert detect_terms('application fee of 25 USD')['entry_fee']['found'] is True
    assert detect_terms('no entry fee')['entry_fee']['found'] is False
    assert detect_terms('grants a non-exclusive license')['rights']['transfer'] is 'license'
    assert detect_terms('assigns all rights')['rights']['transfer'] is 'assignment'
    assert detect_terms('retain all rights')['rights']['transfer'] is 'none'

def _selftest() -> int:
    """Self-test materialized from the TaskIR test_spec — returns 1 on any failure so a broken
    or fake generation cannot pass (paired with the AEGIS fake-function gate)."""
    _fails = 0
    try:
        r = detect_terms('The application fee is $75.')
        assert r['entry_fee']['found'] is True and r['entry_fee']['amount'] == 75.0 and r['entry_fee']['currency'] == 'USD'
    except Exception as _e:
        _fails += 1
        print('FAIL: ' + "r = detect_terms('The application fee is $75.'); assert r['entry_fee']['found'] is True and r['entry" + ' -> ' + str(_e))
    try:
        r = detect_terms('There is no entry fee.')
        assert r['entry_fee']['found'] is False
    except Exception as _e:
        _fails += 1
        print('FAIL: ' + "r = detect_terms('There is no entry fee.'); assert r['entry_fee']['found'] is False" + ' -> ' + str(_e))
    try:
        r = detect_terms('The winner grants a non-exclusive license to the organizer.')
        assert r['rights']['transfer'] == 'license'
    except Exception as _e:
        _fails += 1
        print('FAIL: ' + "r = detect_terms('The winner grants a non-exclusive license to the organizer.'); assert r['rights'][" + ' -> ' + str(_e))
    try:
        r = detect_terms('The winner assigns all rights to the organizer.')
        assert r['rights']['transfer'] == 'assignment'
    except Exception as _e:
        _fails += 1
        print('FAIL: ' + "r = detect_terms('The winner assigns all rights to the organizer.'); assert r['rights']['transfer'] " + ' -> ' + str(_e))
    try:
        r = detect_terms('The winner retains all rights.')
        assert r['rights']['transfer'] == 'none'
    except Exception as _e:
        _fails += 1
        print('FAIL: ' + "r = detect_terms('The winner retains all rights.'); assert r['rights']['transfer'] == 'none'" + ' -> ' + str(_e))
    print('selftest: opportunity_terms_verifier — %d/5 assertions passed' % (5 - _fails))
    return 1 if _fails else 0

if __name__ == "__main__":
    import sys as _s
    _s.exit(_selftest() if '--selftest' in _s.argv else 0)
