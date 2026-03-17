cmake_minimum_required(VERSION 3.15)
project(tradealytics_core)

set(CMAKE_CXX_STANDARD 17)

find_package(Python3 COMPONENTS Interpreter Development REQUIRED)
find_package(pybind11 CONFIG REQUIRED)

pybind11_add_module(tradealytics_core
    src/bindings.cpp
    src/detectors.cpp
    src/features.cpp
)

target_include_directories(tradealytics_core PRIVATE include)
