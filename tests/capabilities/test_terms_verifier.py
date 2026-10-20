# ─── CGRF Header ───────────────────────────────────────────────
# File:        tests/capabilities/test_terms_verifier.py
# Stage:       11_COMMIT
# SRS:         SRS-CN-BUILDER-INTEGRATION-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-BUILDER-INTEGRATION-001
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md, capabilities/opportunity_terms/terms_verifier.py
# EnumType:    Test
# EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md; VALIDATES capabilities/opportunity_terms/terms_verifier.py
# DAG Node:    none
# Intent:      Reject fee and rights extraction regressions using exact-source evidence, negation, precedence and invalid-input cases.
# ───────────────────────────────────────────────────────────────

"""Check extraction evidence used in opportunity admission decisions."""
import unittest
from capabilities.opportunity_terms.terms_verifier import detect_terms

class TermsVerifierTests(unittest.TestCase):
    def test_fee_variants_preserve_exact_evidence(self):
        for text, amount in [('$75 entry fee',75), ('application fee of 25 USD',25),
                             ('The application fee is $75.',75), ('USD 1,250.50 submission fee',1250.5),
                             ('ENTRY FEE: $12.50',12.5)]:
            with self.subTest(text=text):
                result=detect_terms(text)['entry_fee']
                self.assertTrue(result['found'])
                self.assertEqual(result['amount'],amount)
                self.assertEqual(result['currency'],'USD')
                self.assertIn(result['quote'],text)

    def test_explicit_free_fee_has_evidence(self):
        result=detect_terms('There is NO entry fee.')['entry_fee']
        self.assertFalse(result['found'])
        self.assertEqual(result['quote'],'NO entry fee')

    def test_prize_is_not_an_entry_fee(self):
        result=detect_terms('Win a $500 prize. Entry details forthcoming.')['entry_fee']
        self.assertFalse(result['found'])
        self.assertIsNone(result['quote'])
        self.assertIsNone(result['amount'])

    def test_rights_quotes_are_exact(self):
        for text, transfer in [('The winner retains all rights.','none'),
                               ('The author grants a non-exclusive license.','license'),
                               ('The winner ASSIGNS ALL RIGHTS.','assignment')]:
            with self.subTest(text=text):
                rights=detect_terms(text)['rights']
                self.assertEqual(rights['transfer'],transfer)
                self.assertIn(rights['quote'],text)

    def test_assignment_is_not_hidden_by_a_license(self):
        result=detect_terms('Author grants a non-exclusive license but the winner assigns all rights.')
        self.assertEqual(result['rights']['transfer'],'assignment')

    def test_negated_assignment_is_not_reported_as_a_transfer(self):
        result=detect_terms('The author does not assign all rights.')
        self.assertEqual(result['rights']['transfer'],'unknown')

    def test_rejects_invalid_input(self):
        for invalid in ('', '   ', None, 1, [], {}):
            with self.subTest(value=invalid):
                with self.assertRaises((TypeError,ValueError)):
                    detect_terms(invalid)

if __name__ == '__main__':
    unittest.main()
