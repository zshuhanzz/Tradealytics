#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "tradealytics.h"

namespace py = pybind11;

PYBIND11_MODULE(tradealytics_core, m) {
    m.doc() = "Tradealytics C++ core: bias detectors and feature extractor";

    py::class_<DetectorResult>(m, "DetectorResult")
        .def_readonly("score", &DetectorResult::score)
        .def_readonly("flag_indices", &DetectorResult::flag_indices)
        .def_readonly("stats", &DetectorResult::stats);

    m.def("detect_overtrading", &detect_overtrading,
        py::arg("timestamps"),
        py::arg("sides"),
        py::arg("symbols"),
        py::arg("quantities"),
        py::arg("pnl"),
        py::arg("trades_per_day_threshold") = 15,
        py::arg("burst_window_minutes") = 10,
        py::arg("burst_threshold") = 5
    );

    m.def("detect_loss_aversion", &detect_loss_aversion,
        py::arg("timestamps"),
        py::arg("pnl"),
        py::arg("hold_minutes")
    );

    m.def("detect_revenge_trading", &detect_revenge_trading,
        py::arg("timestamps"),
        py::arg("pnl"),
        py::arg("quantities"),
        py::arg("reentry_window_minutes") = 15,
        py::arg("size_multiplier_threshold") = 1.25,
        py::arg("streak_threshold") = 2
    );

    m.def("extract_features", &extract_features,
        py::arg("timestamps"),
        py::arg("pnl"),
        py::arg("quantities"),
        py::arg("sides"),
        py::arg("prices"),
        py::arg("balance")
    );
}
