import 'package:flutter/material.dart';
import 'dart:math' as math;

/// Simple flipping playing card widget.
/// Usage: PlayingCard(front: Text('A♠'), back: Text('?'))
class PlayingCard extends StatefulWidget {
  final Widget front;
  final Widget back;
  final Duration duration;

  const PlayingCard({required this.front, required this.back, this.duration = const Duration(milliseconds: 400), Key? key}) : super(key: key);

  @override
  _PlayingCardState createState() => _PlayingCardState();
}

class _PlayingCardState extends State<PlayingCard> with SingleTickerProviderStateMixin {
  late AnimationController _ctl;
  bool _showFront = true;

  @override
  void initState() {
    super.initState();
    _ctl = AnimationController(vsync: this, duration: widget.duration);
    _ctl.addStatusListener((s) {
      if (s == AnimationStatus.completed) {
        _showFront = !_showFront;
        _ctl.reset();
        setState(() {});
      }
    });
  }

  void flip() {
    if (_ctl.isAnimating) return;
    _ctl.forward();
  }

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final anim = Tween(begin: 0.0, end: math.pi).animate(CurvedAnimation(parent: _ctl, curve: Curves.easeInOut));
    return GestureDetector(
      onTap: flip,
      child: AnimatedBuilder(
        animation: anim,
        builder: (_, __) {
          final angle = anim.value;
          final isFrontVisible = angle < math.pi / 2 ? _showFront : !_showFront;
          return Transform(
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateY(angle),
            alignment: Alignment.center,
            child: Container(
              width: 64,
              height: 92,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(6),
                boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0,2))],
              ),
              child: isFrontVisible ? widget.front : Transform(
                transform: Matrix4.identity()..rotateY(math.pi),
                alignment: Alignment.center,
                child: widget.back,
              ),
            ),
          );
        },
      ),
    );
  }
}