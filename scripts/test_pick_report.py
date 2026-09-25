import json
import os
import tempfile
import unittest

import pick_report


def feed(day, generated, us_known=True, extra=None, status="ok"):
    r = {"warKey": "a|b@%d" % day, "generatedAt": generated, "usKnown": us_known,
         "us": {"name": "Unessentials"}, "them": {"name": "Enemy %d" % day}, "date": str(day)}
    r.update(extra or {})
    return {"status": status, "report": r} if status == "ok" else {"status": status}


class PickTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def write(self, name, payload):
        p = os.path.join(self.dir, name)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(payload if isinstance(payload, str) else json.dumps(payload))
        return p

    def test_newer_war_wins(self):
        a = self.write("a", feed(20716, 5))
        b = self.write("b", feed(20719, 1))
        self.assertEqual(pick_report.pick([a, b])["report"]["warKey"], "a|b@20719")

    def test_same_war_newer_capture_wins(self):
        a = self.write("a", feed(20719, 5))
        b = self.write("b", feed(20719, 9))
        self.assertEqual(pick_report.pick([a, b])["report"]["generatedAt"], 9)

    def test_known_guild_beats_a_newer_confused_sheet(self):
        a = self.write("a", feed(20716, 5, us_known=True))
        b = self.write("b", feed(20719, 9, us_known=False))
        self.assertTrue(pick_report.pick([a, b])["report"]["usKnown"])

    def test_unusable_feeds_are_skipped(self):
        good = self.write("good", feed(20716, 5))
        bad = [self.write("html", "<html>login</html>"),
               self.write("unsafe", feed(20719, 9, extra={"players": []})),
               self.write("forecast", feed(20719, 9, extra={"forecast": {}})),
               self.write("shape", {"status": "ok", "report": {"us": 1}}),
               os.path.join(self.dir, "missing")]
        self.assertEqual(pick_report.pick(bad + [good])["report"]["warKey"], "a|b@20716")
        self.assertIsNone(pick_report.pick(bad))

    def test_a_report_beats_no_report(self):
        a = self.write("a", feed(0, 0, status="no_report"))
        b = self.write("b", feed(20716, 5))
        self.assertEqual(pick_report.pick([a, b])["status"], "ok")


if __name__ == "__main__":
    unittest.main()
