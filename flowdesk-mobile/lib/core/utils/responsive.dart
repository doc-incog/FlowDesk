import 'package:flutter/material.dart';

class Breakpoints {
  Breakpoints._();

  static const double phone = 600;
  static const double tablet = 900;
  static const double wide = 1200;

  static bool isPhone(BuildContext context) =>
      MediaQuery.sizeOf(context).width < phone;

  static bool isTablet(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    return w >= phone && w < tablet;
  }

  static bool isWide(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= tablet;
}
