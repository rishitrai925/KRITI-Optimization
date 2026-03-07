#pragma once
#include "Employee.h"
#include "Vehicle.h"
#include "Route.h"
#include <vector>
<<<<<<< HEAD
#include "CSVReader.h" 
=======
#include "CSVReader.h"
>>>>>>> 361227c (final hosted)
#include "globals.h"

std::vector<Route> solveALNS(
    const std::vector<Employee> &,
    const std::vector<Vehicle> &,
    const Metadata &);
